#!/bin/bash
#
# Description:
#   Automates the bond issuance process on a local Canton ledger.
#   1. Allocates parties (Issuer, CSD, Paying Agent, Investors).
#   2. Creates a BondIssuance contract.
#   3. Submits subscriptions from investors.
#   4. Settles the issuance, creating the final Bond contracts.
#
# Usage:
#   ./scripts/issue-bond.sh
#
# Prerequisites:
#   - dpm, jq, and curl must be installed and in the PATH.
#   - A Canton sandbox must be running (e.g., via `dpm sandbox`).

set -euo pipefail

# --- Configuration ---
readonly JSON_API_URL="http://localhost:7575"
readonly PROJECT_NAME="canton-bond-issuance"
readonly PROJECT_VERSION="0.1.0"
readonly DAR_FILE=".daml/dist/${PROJECT_NAME}-${PROJECT_VERSION}.dar"
readonly LEDGER_ID="sandbox" # Default for `dpm sandbox`
readonly APP_ID="bond-issuance-script"

# --- Helper Functions ---

# Check for required tools
check_tools() {
  for tool in curl jq dpm; do
    if ! command -v $tool &> /dev/null; then
      echo "Error: Required tool '$tool' is not installed or not in PATH." >&2
      exit 1
    fi
  done
}

# Build the project if DAR is missing
build_project() {
  if [ ! -f "$DAR_FILE" ]; then
    echo "DAR file not found. Building project..."
    dpm build
    if [ ! -f "$DAR_FILE" ]; then
      echo "Error: Failed to build project. DAR file still not found at $DAR_FILE" >&2
      exit 1
    fi
    echo "Project built successfully."
  fi
}

# Generate a JWT for a given set of parties
# Note: This creates a basic, unsigned JWT suitable for `dpm sandbox` with default auth.
generate_jwt() {
  local parties_json="["
  local first=true
  for party in "$@"; do
    if [ "$first" = true ]; then
      parties_json+="\"$party\""
      first=false
    else
      parties_json+=",\"$party\""
    fi
  done
  parties_json+="]"

  local payload
  payload=$(printf '{"https://daml.com/ledger-api": {"ledgerId": "%s", "applicationId": "%s", "actAs": %s}}' "$LEDGER_ID" "$APP_ID" "$parties_json" | base64 | tr -d '\n' | tr '/+' '_-')
  echo "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${payload}."
}

# Make a generic authenticated request to the JSON API
json_api_request() {
  local endpoint=$1
  local token=$2
  local payload=$3
  
  curl -s -X POST "${JSON_API_URL}${endpoint}" \
    -H "Authorization: Bearer ${token}" \
    -H "Content-Type: application/json" \
    -d "${payload}"
}

# Allocate a new party
allocate_party() {
  local hint=$1
  local admin_token
  # Admin endpoints on the sandbox can be called with any validly-formed JWT
  admin_token=$(generate_jwt) 
  
  local payload
  payload=$(printf '{"displayName": "%s"}' "$hint")

  local response
  response=$(json_api_request "/v2/parties/allocate" "$admin_token" "$payload")

  local party_id
  party_id=$(echo "$response" | jq -r '.partyDetails.identifier')

  if [ -z "$party_id" ] || [ "$party_id" == "null" ]; then
    echo "Error: Failed to allocate party with hint '$hint'." >&2
    echo "Response from API: $response" >&2
    exit 1
  fi
  echo "$party_id"
}

# --- Main Script ---

echo "--- Starting Bond Issuance Script ---"

# 1. Prerequisites
check_tools
build_project

PACKAGE_ID=$(dpm damlc inspect-dar --json "${DAR_FILE}" | jq -r .main_package_id)
readonly BOND_ISSUANCE_TID="${PACKAGE_ID}:BondIssuance:BondIssuance"
readonly BOND_SUB_TID="${PACKAGE_ID}:BondIssuance:BondIssuanceSubscription"
readonly BOND_TID="${PACKAGE_ID}:Bond:Bond"

echo "DAML Package ID: ${PACKAGE_ID}"

# 2. Allocate Parties
echo "Allocating parties..."
ISSUER=$(allocate_party "GlobalCorpIssuer")
CSD=$(allocate_party "CentralDepository")
PAYING_AGENT=$(allocate_party "GlobalPayingAgent")
INVESTOR1=$(allocate_party "InvestorAlice")
INVESTOR2=$(allocate_party "InvestorBob")

echo "  Issuer:        ${ISSUER}"
echo "  CSD:           ${CSD}"
echo "  Paying Agent:  ${PAYING_AGENT}"
echo "  Investor 1:    ${INVESTOR1}"
echo "  Investor 2:    ${INVESTOR2}"

# 3. Generate a single JWT with claims for all parties for script simplicity
echo "Generating script admin JWT..."
ADMIN_TOKEN=$(generate_jwt "$ISSUER" "$CSD" "$PAYING_AGENT" "$INVESTOR1" "$INVESTOR2")

# 4. Create BondIssuance Contract
echo "Creating BondIssuance contract..."

ISSUE_DATE=$(date -u +"%Y-%m-%d")
MATURITY_DATE=$(date -u -d "+2 years" +"%Y-%m-%d")
SUBSCRIPTION_START=$(date -u -d "-1 day" +"%Y-%m-%dT%H:%M:%SZ")
SUBSCRIPTION_END=$(date -u -d "+7 days" +"%Y-%m-%dT%H:%M:%SZ")

create_payload=$(cat <<EOF
{
  "templateId": "${BOND_ISSUANCE_TID}",
  "payload": {
    "issuer": "${ISSUER}",
    "csd": "${CSD}",
    "payingAgent": "${PAYING_AGENT}",
    "subscribers": [],
    "id": "BOND-001",
    "description": "Global Corp 5% 2-Year Bond",
    "currency": "USD",
    "issuanceAmount": "1000000.0",
    "denomination": "1000.0",
    "couponRate": "0.05",
    "couponFrequency": "P6M",
    "issueDate": "${ISSUE_DATE}",
    "maturityDate": "${MATURITY_DATE}",
    "subscriptionWindow": {
      "start": "${SUBSCRIPTION_START}",
      "end": "${SUBSCRIPTION_END}"
    },
    "settlementDate": null
  }
}
EOF
)

create_response=$(json_api_request "/v1/create" "$ADMIN_TOKEN" "$create_payload")
ISSUANCE_CID=$(echo "$create_response" | jq -r '.result.contractId')

if [ -z "$ISSUANCE_CID" ] || [ "$ISSUANCE_CID" == "null" ]; then
  echo "Error: Failed to create BondIssuance contract." >&2
  echo "Response: ${create_response}" >&2
  exit 1
fi
echo "  BondIssuance contract created with ID: ${ISSUANCE_CID}"

# 5. Investors Subscribe
echo "Investors subscribing to the issuance..."

sub1_payload=$(printf '{ "templateId": "%s", "contractId": "%s", "choice": "Subscribe", "argument": { "investor": "%s", "amount": "50000.0" } }' "$BOND_ISSUANCE_TID" "$ISSUANCE_CID" "$INVESTOR1")
sub1_response=$(json_api_request "/v1/exercise" "$ADMIN_TOKEN" "$sub1_payload")
if ! echo "$sub1_response" | jq -e '.result.events' > /dev/null; then
  echo "Error: Investor 1 failed to subscribe." >&2
  echo "Response: ${sub1_response}" >&2
  exit 1
fi
echo "  Investor 1 subscribed successfully."

sub2_payload=$(printf '{ "templateId": "%s", "contractId": "%s", "choice": "Subscribe", "argument": { "investor": "%s", "amount": "75000.0" } }' "$BOND_ISSUANCE_TID" "$ISSUANCE_CID" "$INVESTOR2")
sub2_response=$(json_api_request "/v1/exercise" "$ADMIN_TOKEN" "$sub2_payload")
if ! echo "$sub2_response" | jq -e '.result.events' > /dev/null; then
  echo "Error: Investor 2 failed to subscribe." >&2
  echo "Response: ${sub2_response}" >&2
  exit 1
fi
echo "  Investor 2 subscribed successfully."

# 6. Settle the Issuance
echo "Settling the bond issuance..."

query_payload=$(printf '{ "templateIds": ["%s"] }' "$BOND_SUB_TID")
query_response=$(json_api_request "/v1/query" "$ADMIN_TOKEN" "$query_payload")

SUB_CIDS=$(echo "$query_response" | jq -r '[.result[].contractId]')
echo "  Found subscription contract IDs: ${SUB_CIDS}"

settle_payload=$(printf '{ "templateId": "%s", "contractId": "%s", "choice": "Settle", "argument": { "subscriptionCids": %s } }' "$BOND_ISSUANCE_TID" "$ISSUANCE_CID" "$SUB_CIDS")
settle_response=$(json_api_request "/v1/exercise" "$ADMIN_TOKEN" "$settle_payload")

if ! echo "$settle_response" | jq -e '.result.events' > /dev/null; then
  echo "Error: Failed to settle the issuance." >&2
  echo "Response: ${settle_response}" >&2
  exit 1
fi
echo "  Issuance settled successfully."

# 7. Verify Bond Creation
echo "Verifying bond contract creation..."
verify_query_payload=$(printf '{ "templateIds": ["%s"] }' "$BOND_TID")
verify_response=$(json_api_request "/v1/query" "$ADMIN_TOKEN" "$verify_query_payload")

BOND_COUNT=$(echo "$verify_response" | jq -r '.result | length')
if [ "$BOND_COUNT" -ne 2 ]; then
  echo "Error: Expected 2 Bond contracts to be created, but found ${BOND_COUNT}." >&2
  echo "Query Response: ${verify_response}" >&2
  exit 1
fi
echo "  Successfully verified that ${BOND_COUNT} Bond contracts were created."
echo "$verify_response" | jq '.result'

echo
echo "--- Script Finished Successfully ---"