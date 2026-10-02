#!/bin/bash
# Simple one-line curl command for testing NILRA endpoint

# Load .env file if it exists
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

# Get values from ENV - fail if not set (no fallbacks)
if [ -z "$EXPO_PUBLIC_TWILIO_NILRA_HANDLER_URL" ]; then
  echo "Error: EXPO_PUBLIC_TWILIO_NILRA_HANDLER_URL environment variable is not set"
  exit 1
fi

if [ -z "$EXPO_PUBLIC_TWILIO_API_SECRET" ]; then
  echo "Error: EXPO_PUBLIC_TWILIO_API_SECRET environment variable is not set"
  exit 1
fi

# Print the URLs being used for verification
echo "Twilio Proxy Endpoint (being called): $EXPO_PUBLIC_TWILIO_NILRA_HANDLER_URL"
if [ -n "$EXPO_PUBLIC_TWILIO_NILRA_HANDLER_URL" ]; then
  echo "NILRA API URL (configured in Twilio Function): $EXPO_PUBLIC_TWILIO_NILRA_HANDLER_URL"
else
  echo "NILRA API URL: Not set in ENV (configured server-side in Twilio Function)"
fi
echo ""

curl -X POST "$EXPO_PUBLIC_TWILIO_NILRA_HANDLER_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "intakeData": {
      "hasImmigrationAttorney": "Yes",
      "immigrationAttorneyNotes": "Test notes",
      "alienNumber": "847334156",
      "lastName": "Fromscript",
      "middleName": "",
      "firstName": "Test",
      "birthDate": "1990-12-25",
      "birthCountry": "Mexico",
      "citizenship": "Mexico",
      "canContact": true,
      "contactPerson": {
        "relationship": "Friend",
        "lastName": "Contact",
        "firstName": "Emergency",
        "phone": "+15551234567",
        "email": "contact@example.com"
      },
      "latitudeLocation": null,
      "longitudeLocation": null,
      "locationStreet": "",
      "locationCity": "",
      "locationState": "",
      "locationZipCode": ""
    },
    "metadata": {
      "userId": "test-user",
      "phoneNumber": "+15551234567",
      "appLanguage": "en",
      "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")'"
    },
    "auth": {
      "apiKey": "'"$EXPO_PUBLIC_TWILIO_API_SECRET"'"
    }
  }'
