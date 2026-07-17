package whatsapp

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"
)

// WabaProvider talks to Meta's WhatsApp Business Cloud API.
// https://developers.facebook.com/docs/whatsapp/cloud-api
type WabaProvider struct{}

const wabaAPIVersion = "v20.0"

func wabaRequest(body any) error {
	if cfg == nil || cfg.WabaAccessToken == "" || cfg.WabaPhoneNumberID == "" {
		return fmt.Errorf("WABA_ACCESS_TOKEN / WABA_PHONE_NUMBER_ID not configured")
	}

	b, err := json.Marshal(body)
	if err != nil {
		return err
	}

	url := fmt.Sprintf("https://graph.facebook.com/%s/%s/messages", wabaAPIVersion, cfg.WabaPhoneNumberID)
	req, err := http.NewRequest("POST", url, bytes.NewReader(b))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+cfg.WabaAccessToken)

	client := &http.Client{Timeout: 10 * time.Second}
	res, err := client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()

	respBody, _ := io.ReadAll(res.Body)
	if res.StatusCode >= 300 {
		return fmt.Errorf("WABA request failed (%d): %s", res.StatusCode, string(respBody))
	}
	return nil
}

func (p *WabaProvider) SendText(_, phone, text string) error {
	return wabaRequest(map[string]any{
		"messaging_product": "whatsapp",
		"to":                phone,
		"type":              "text",
		"text":              map[string]string{"body": text},
	})
}

// MarkAsRead requires the wamid of the specific inbound message — Meta's Cloud
// API has no per-chat "mark as seen" like WAHA does. If we don't have one on
// record (e.g. an older Chat row from before this field existed), log and no-op
// rather than failing the caller.
func (p *WabaProvider) MarkAsRead(_, _ string, lastInboundMessageID *string) error {
	if lastInboundMessageID == nil || *lastInboundMessageID == "" {
		log.Println("waba: no provider_message_id on record, skipping mark-as-read")
		return nil
	}
	return wabaRequest(map[string]any{
		"messaging_product": "whatsapp",
		"status":            "read",
		"message_id":        *lastInboundMessageID,
	})
}
