package metaads

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/ayt-sales/backend/internal/config"
)

// messagingConversationStartedAction is the Meta action_type reported for
// Click-to-WhatsApp campaigns when someone starts a chat from the ad — the
// closest proxy Meta exposes to "leads" for this ad format.
const messagingConversationStartedAction = "onsite_conversion.messaging_conversation_started_7d"

const apiVersion = "v20.0"

var cfg *config.Config

func Init(c *config.Config) { cfg = c }

type DailyInsight struct {
	Date          time.Time
	Spend         float64
	Impressions   int64
	Clicks        int64
	Conversations int64
}

type insightsResponse struct {
	Data []struct {
		Spend       string `json:"spend"`
		Impressions string `json:"impressions"`
		Clicks      string `json:"clicks"`
		DateStart   string `json:"date_start"`
		Actions     []struct {
			ActionType string `json:"action_type"`
			Value      string `json:"value"`
		} `json:"actions"`
	} `json:"data"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

// FetchDailyInsights pulls one row per day in [dateFrom, dateTo] (both
// "2006-01-02") from the Meta Marketing API Insights endpoint for the
// configured ad account.
func FetchDailyInsights(dateFrom, dateTo string) ([]DailyInsight, error) {
	if cfg == nil || cfg.MetaAdAccountID == "" || cfg.MetaAccessToken == "" {
		return nil, fmt.Errorf("META_AD_ACCOUNT_ID / META_ACCESS_TOKEN not configured")
	}

	timeRange := fmt.Sprintf(`{"since":"%s","until":"%s"}`, dateFrom, dateTo)
	q := url.Values{}
	q.Set("fields", "spend,impressions,clicks,actions,date_start")
	q.Set("time_range", timeRange)
	q.Set("time_increment", "1")
	q.Set("limit", "1000")
	q.Set("access_token", cfg.MetaAccessToken)

	reqURL := fmt.Sprintf("https://graph.facebook.com/%s/%s/insights?%s", apiVersion, cfg.MetaAdAccountID, q.Encode())

	client := &http.Client{Timeout: 15 * time.Second}
	res, err := client.Get(reqURL)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	var parsed insightsResponse
	if err := json.NewDecoder(res.Body).Decode(&parsed); err != nil {
		return nil, err
	}
	if parsed.Error != nil {
		return nil, fmt.Errorf("meta graph api error: %s", parsed.Error.Message)
	}

	rows := make([]DailyInsight, 0, len(parsed.Data))
	for _, d := range parsed.Data {
		date, err := time.Parse("2006-01-02", d.DateStart)
		if err != nil {
			continue
		}
		var conversations int64
		for _, a := range d.Actions {
			if a.ActionType == messagingConversationStartedAction {
				conversations, _ = strconv.ParseInt(a.Value, 10, 64)
				break
			}
		}
		spend, _ := strconv.ParseFloat(d.Spend, 64)
		impressions, _ := strconv.ParseInt(d.Impressions, 10, 64)
		clicks, _ := strconv.ParseInt(d.Clicks, 10, 64)

		rows = append(rows, DailyInsight{
			Date:          date,
			Spend:         spend,
			Impressions:   impressions,
			Clicks:        clicks,
			Conversations: conversations,
		})
	}

	return rows, nil
}
