package whatsapp

import (
	"fmt"
	"sync"
	"time"
)

// maxMessagesPerContactPerHour follows WAHA's own anti-blocking guidance:
// https://waha.devlike.pro/docs/overview/how-to-avoid-blocking/
// ("send a maximum of 4 messages per contact that have replied for one hour,
// then stop sending for one hour before starting again").
const maxMessagesPerContactPerHour = 4

// contactRateLimiter tracks recent outbound send timestamps per phone number,
// in-memory only — resets on restart, which is fine for a soft anti-blocking
// guardrail rather than a hard compliance requirement.
type contactRateLimiter struct {
	mu    sync.Mutex
	sends map[string][]time.Time
}

var wahaRateLimiter = &contactRateLimiter{sends: map[string][]time.Time{}}

// Allow reports whether a new message to phone is permitted right now, and
// records the send if so.
func (l *contactRateLimiter) Allow(phone string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	cutoff := time.Now().Add(-1 * time.Hour)
	kept := make([]time.Time, 0, len(l.sends[phone]))
	for _, t := range l.sends[phone] {
		if t.After(cutoff) {
			kept = append(kept, t)
		}
	}

	if len(kept) >= maxMessagesPerContactPerHour {
		l.sends[phone] = kept
		return false
	}

	l.sends[phone] = append(kept, time.Now())
	return true
}

func rateLimitError(phone string) error {
	return fmt.Errorf("rate limit: sudah %d pesan ke %s dalam 1 jam terakhir (batas anti-blokir WAHA), coba lagi nanti", maxMessagesPerContactPerHour, phone)
}
