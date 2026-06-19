#!/bin/bash

API_URL="${API_URL:-http://localhost:3001/api}"

echo "======================================"
echo "API_URL: $API_URL"
echo "======================================"
echo ""

request() {
  local name="$1"
  local url="$2"

  echo ""
  echo "======================================"
  echo "$name"
  echo "GET $url"
  echo "======================================"

  curl -s "$url" | jq . || curl -s "$url"

  echo ""
}

request "Dashboard Summary" "$API_URL/dashboard/summary"
request "Specialties" "$API_URL/specialties"
request "Doctors" "$API_URL/doctors"
request "Appointments" "$API_URL/appointments"
request "Opportunities" "$API_URL/opportunities"
request "Tickets" "$API_URL/tickets"