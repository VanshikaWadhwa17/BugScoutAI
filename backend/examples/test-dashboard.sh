#!/bin/bash

# Test script for dashboard API
# Make sure to replace AUTH_TOKEN with your actual auth token from .env

AUTH_TOKEN="your-secret-token-here"
BASE_URL="http://localhost:3000"

echo "📊 Testing Dashboard API..."
echo ""

# Test 1: Get all sessions
echo "Test 1: Get all sessions"
curl -X GET "$BASE_URL/dashboard/sessions" \
  -H "X-Auth-Token: $AUTH_TOKEN"
echo -e "\n\n"

# Test 2: Get sessions for specific project
echo "Test 2: Get sessions for project_id=1"
curl -X GET "$BASE_URL/dashboard/sessions?project_id=1" \
  -H "X-Auth-Token: $AUTH_TOKEN"
echo -e "\n\n"

# Test 3: Get events for a session
echo "Test 3: Get events for session"
SESSION_ID="test_session_1"
curl -X GET "$BASE_URL/dashboard/sessions/$SESSION_ID/events" \
  -H "X-Auth-Token: $AUTH_TOKEN"
echo -e "\n\n"

# Test 4: Get all issues
echo "Test 4: Get all issues"
curl -X GET "$BASE_URL/dashboard/issues" \
  -H "X-Auth-Token: $AUTH_TOKEN"
echo -e "\n\n"

# Test 5: Get rage clicks only
echo "Test 5: Get rage clicks only"
curl -X GET "$BASE_URL/dashboard/issues?issue_type=rage_click" \
  -H "X-Auth-Token: $AUTH_TOKEN"
echo -e "\n\n"

# Test 6: Get dead clicks only
echo "Test 6: Get dead clicks only"
curl -X GET "$BASE_URL/dashboard/issues?issue_type=dead_click" \
  -H "X-Auth-Token: $AUTH_TOKEN"
echo -e "\n\n"

echo "✅ Dashboard tests complete!"
