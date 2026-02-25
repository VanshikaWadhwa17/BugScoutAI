#!/bin/bash

# Test script for ingestion API
# Make sure to replace API_KEY with your actual project API key

API_KEY="test-api-key-123"
BASE_URL="http://localhost:3000"

echo "🧪 Testing Ingestion API..."
echo ""

# Test 1: Simple click event
echo "Test 1: Single click event"
curl -X POST "$BASE_URL/ingest" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "session_id": "test_session_1",
    "events": [
      {
        "type": "click",
        "timestamp": 1730000000000,
        "meta": {
          "selector": "#button"
        }
      }
    ]
  }'
echo -e "\n\n"

# Test 2: Rage click detection (4 clicks in < 2 seconds)
echo "Test 2: Rage click detection (4 clicks on same element)"
curl -X POST "$BASE_URL/ingest" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "session_id": "test_session_2",
    "events": [
      {
        "type": "click",
        "timestamp": 1730000000000,
        "meta": {"selector": "#pricing"}
      },
      {
        "type": "click",
        "timestamp": 1730000000500,
        "meta": {"selector": "#pricing"}
      },
      {
        "type": "click",
        "timestamp": 1730000001000,
        "meta": {"selector": "#pricing"}
      },
      {
        "type": "click",
        "timestamp": 1730000001500,
        "meta": {"selector": "#pricing"}
      }
    ]
  }'
echo -e "\n\n"

# Test 3: Dead click detection (click with no response)
echo "Test 3: Dead click detection"
curl -X POST "$BASE_URL/ingest" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "session_id": "test_session_3",
    "events": [
      {
        "type": "click",
        "timestamp": 1730000000000,
        "meta": {"selector": "#broken-button"}
      }
    ]
  }'
echo -e "\n\n"

# Test 4: Session timeline (clicks, scrolls, navigation)
echo "Test 4: Session timeline"
curl -X POST "$BASE_URL/ingest" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "session_id": "test_session_4",
    "events": [
      {
        "type": "click",
        "timestamp": 1730000000000,
        "meta": {"selector": "#checkout"}
      },
      {
        "type": "scroll",
        "timestamp": 1730000001000,
        "meta": {"scrollY": 500}
      },
      {
        "type": "navigation",
        "timestamp": 1730000002000,
        "meta": {"url": "/checkout"}
      }
    ]
  }'
echo -e "\n\n"

echo "✅ Tests complete!"
echo ""
echo "Now check the dashboard:"
echo "  GET $BASE_URL/dashboard/sessions -H 'X-Auth-Token: YOUR_AUTH_TOKEN'"
echo "  GET $BASE_URL/dashboard/issues -H 'X-Auth-Token: YOUR_AUTH_TOKEN'"
