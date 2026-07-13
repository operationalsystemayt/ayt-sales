package whatsapp

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// WahaProvider talks to a self-hosted WAHA (WhatsApp HTTP API) instance.
// https://waha.devlike.pro
type WahaProvider struct{}

func wahaChatID(phone string) string {
	return phone + "@c.us"
}

func wahaRequest(method, path string, body any) ([]byte, error) {
	if cfg == nil || cfg.WahaBaseURL == "" {
		return nil, fmt.Errorf("WAHA_BASE_URL not configured")
	}

	var reqBody io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		reqBody = bytes.NewReader(b)
	}

	req, err := http.NewRequest(method, cfg.WahaBaseURL+path, reqBody)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	if cfg.WahaAPIKey != "" {
		req.Header.Set("X-Api-Key", cfg.WahaAPIKey)
	}

	client := &http.Client{Timeout: 10 * time.Second}
	res, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	respBody, _ := io.ReadAll(res.Body)
	if res.StatusCode >= 300 {
		return nil, fmt.Errorf("WAHA request failed (%d): %s", res.StatusCode, string(respBody))
	}
	return respBody, nil
}

// SendText follows WAHA's anti-blocking guidance: send-seen, then simulate
// typing for a duration proportional to the message length, then send —
// rather than firing the message immediately — and enforces a basic
// per-contact rate limit before any of that.
// https://waha.devlike.pro/docs/overview/how-to-avoid-blocking/
func (p *WahaProvider) SendText(phone, text string) error {
	if !wahaRateLimiter.Allow(phone) {
		return rateLimitError(phone)
	}

	chatID := wahaChatID(phone)
	session := map[string]string{"session": cfg.WahaSession, "chatId": chatID}

	// Best-effort human-like sequence — a failure at any of these steps still
	// falls through to attempting the actual send below.
	wahaRequest("POST", "/api/sendSeen", session)
	wahaRequest("POST", "/api/startTyping", session)
	time.Sleep(typingDuration(text))
	wahaRequest("POST", "/api/stopTyping", session)

	_, err := wahaRequest("POST", "/api/sendText", map[string]string{
		"session": cfg.WahaSession,
		"chatId":  chatID,
		"text":    text,
	})
	return err
}

// typingDuration is a heuristic (~50ms/char, clamped to a plausible human
// range) — WAHA's docs call for "simulate typing" without prescribing an
// exact formula.
func typingDuration(text string) time.Duration {
	d := time.Duration(len(text)) * 50 * time.Millisecond
	if d < 800*time.Millisecond {
		return 800 * time.Millisecond
	}
	if d > 4*time.Second {
		return 4 * time.Second
	}
	return d
}

func (p *WahaProvider) MarkAsRead(phone string, _ *string) error {
	_, err := wahaRequest("POST", "/api/sendSeen", map[string]string{
		"session": cfg.WahaSession,
		"chatId":  wahaChatID(phone),
	})
	return err
}

type wahaMessage struct {
	ID        string `json:"id"`
	Timestamp int64  `json:"timestamp"`
	FromMe    bool   `json:"fromMe"`
	Body      string `json:"body"`
}

type wahaLidResponse struct {
	Lid string `json:"lid"`
	PN  string `json:"pn"`
}

// ResolveLid attempts to map a WhatsApp LID (the privacy-masked identifier
// WhatsApp now uses in place of a phone number in some message payloads) back
// to the sender's real phone number, via WAHA's contact lookup. Returns
// ok=false if WAHA has no mapping on file — e.g. the sender isn't in the
// connected account's contacts, which is expected for a cold inbound lead.
// https://waha.devlike.pro/docs/how-to/contacts/
func ResolveLid(lid string) (phone string, ok bool) {
	lid = strings.TrimSuffix(lid, "@lid")
	body, err := wahaRequest("GET", fmt.Sprintf("/api/%s/lids/%s", cfg.WahaSession, lid), nil)
	if err != nil {
		return "", false
	}
	var res wahaLidResponse
	if err := json.Unmarshal(body, &res); err != nil || res.PN == "" {
		return "", false
	}
	return strings.TrimSuffix(res.PN, "@c.us"), true
}

func (p *WahaProvider) FetchHistory(phone string, limit int) ([]HistoryMessage, error) {
	path := fmt.Sprintf("/api/%s/chats/%s/messages?limit=%d", cfg.WahaSession, wahaChatID(phone), limit)
	body, err := wahaRequest("GET", path, nil)
	if err != nil {
		return nil, err
	}

	var msgs []wahaMessage
	if err := json.Unmarshal(body, &msgs); err != nil {
		return nil, fmt.Errorf("failed to parse WAHA history response: %w", err)
	}

	out := make([]HistoryMessage, 0, len(msgs))
	for _, m := range msgs {
		out = append(out, HistoryMessage{
			ProviderMessageID: m.ID,
			FromMe:            m.FromMe,
			Body:              m.Body,
			Timestamp:         time.Unix(m.Timestamp, 0),
		})
	}
	return out, nil
}
