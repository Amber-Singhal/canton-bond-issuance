#!/usr/bin/env bash

# This script automates the issuance of a sample bond on a local Canton sandbox.
# It performs the following steps:
# 1. Allocates parties: Issuer, PayingAgent, and two Investors.
# 2. Proposes a new bond issuance from the Issuer to the PayingAgent.
# 3. The PayingAgent accepts the proposal, creating the official BondIssuance contract.
# 4. Two investors submit subscription requests for the bond.
# 5. The Issuer accepts the subscriptions, creating BondHolding contracts for the investors.
#
# Prerequisites:
# - A running Canton sandbox with the JSON API enabled at http://localhost:7575
# - The canton-bond-issuance project must be compiled (`dpm build`).
# - `curl`, `jq`, and `openssl` must be installed and available in the PATH.

set -euo pipefail

# --- Configuration ---
JSON_API_URL="http://localhost:7575"
DAML_PROJECT_ROOT="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
DAR_PATH="${DAML_PROJECT_ROOT}/.daml/dist/canton-bond-issuance-0.1.0.dar"
APP_ID="bond-issuance-script"

# --- Helper Functions ---

# Simple Base64URL encoding using openssl for cross-platform compatibility.
function base64url() {
  openssl base64 -e -A | tr '+/' '-_' | tr -d '='
}

# Creates a JWT token for a given party ID for use with the sandbox.
# Note: This is an unsigned token, only suitable for sandbox environments
# where authentication is disabled.
function create_jwt() {
  local party_id="$1"
  local ledger_id="sandbox"
  local header='{"alg":"HS256","typ":"JWT"}'
  local payload="{\"ledgerId\":\"${ledger_id}\",\"applicationId\":\"${APP_ID}\",\"actAs\":[\"${party_id}\"]}"
  local b64_header=$(echo -n "${header}" | base64url)
  local b64_payload=$(echo -n "${payload}" | base64url)
  echo "${b64_header}.${b64_payload}."
}

# Allocates a new party on the ledger via the v2 API.
function allocate_party() {
  local display_name="$1"
  local payload="{\"displayName\": \"${display_name}\"}"
  
  local response=$(curl -s -X POST "${JSON_API_URL}/v2/parties/allocate" \
    -H "Content-Type: application/json" \
    -d "${payload}")
  
  local party_id=$(echo "${response}" | jq -r '.partyDetails.identifier')
  
  if [ "${party_id}" == "null" ] || [ -z "${party_id}" ]; then
    echo "Error allocating party '${display_name}'. Response:" >&2
    echo "${response}" >&2
    exit 1
  fi
  
  echo "${party_id}"
}

# Submits a command to the JSON API and handles errors.
function submit_command() {
    local jwt="$1"
    local command_type="$2" # "create" or "exercise"
    local payload="$3"
    
    local endpoint="/v1/${command_type}"

    local response=$(curl -s -w '%{http_code}' -X POST "${JSON_API_URL}${endpoint}" \
      -H "Authorization: Bearer ${jwt}" \
      -H "Content-Type: application/json" \
      -d "${payload}")

    local http_code=${response: -3}
    local body=${response::-3}

    if [ "$http_code" -ne 200 ]; then
        echo "Error: Received HTTP ${http_code} from JSON API." >&2
        echo "Response Body:" >&2
        echo "${body}" | jq '.' >&2
        exit 1
    fi

    # Check for Daml-level errors in the response body
    if echo "${body}" | jq -e '.errors' > /dev/null; then
        echo "Error submitting ${command_type} command:" >&2
        echo "${body}" | jq '.' >&2
        exit 1
    fi

    echo "${body}"
}

# --- Main Script ---

echo "--- Setup ---"

for cmd in curl jq openssl dpm; do
  if ! command -v "$cmd" &> /dev/null; then
    echo "Error: required command '$cmd' is not installed. Please install it to run this script." >&2
    exit 1
  fi
done

if [ ! -f "${DAR_PATH}" ]; then
    echo "Error: DAR file not found at ${DAR_PATH}" >&2
    echo "Please run 'dpm build' in the project root directory first." >&2
    exit 1
fi

echo "Extracting Package ID from DAR..."
PKG_ID=$(dpm damlc inspect-dar --json "${DAR_PATH}" | jq -r .main_package_id)
if [ -z "${PKG_ID}" ] || [ "${PKG_ID}" == "null" ]; then
    echo "Error: Could not extract Package ID from DAR." >&2
    exit 1
fi
echo "  Package ID: ${PKG_ID}"
echo

echo "Allocating parties..."
ISSUER_ID=$(allocate_party "GlobalCorpIssuer")
PAYING_AGENT_ID=$(allocate_party "CentralPayingAgent")
INVESTOR_A_ID=$(allocate_party "InvestorAlice")
INVESTOR_B_ID=$(allocate_party "InvestorBob")
echo "  Issuer:       ${ISSUER_ID}"
echo "  Paying Agent: ${PAYING_AGENT_ID}"
echo "  Investor A:   ${INVESTOR_A_ID}"
echo "  Investor B:   ${INVESTOR_B_ID}"
echo

echo "Generating JWTs for each party..."
ISSUER_JWT=$(create_jwt "${ISSUER_ID}")
PAYING_AGENT_JWT=$(create_jwt "${PAYING_AGENT_ID}")
INVESTOR_A_JWT=$(create_jwt "${INVESTOR_A_ID}")
INVESTOR_B_JWT=$(create_jwt "${INVESTOR_B_ID}")
echo "  JWTs generated."
echo

# Bond Details
# Note: `date -d` is for GNU date. On macOS, use `gdate` from `coreutils`
# or `date -v+2y`
ISSUE_DATE=$(date -u +%Y-%m-%d)
MATURITY_DATE=$(date -u -d "2 years" +%Y-%m-%d)
COUPON_DATE_1=$(date -u -d "1 year" +%Y-%m-%d)
COUPON_DATE_2=$MATURITY_DATE

echo "--- Step 1: Issuer proposes bond issuance ---"

PROPOSAL_PAYLOAD=$(cat <<EOF
{
  "templateId": "${PKG_ID}:Issuance.BondIssuanceProposal",
  "payload": {
    "issuer": "${ISSUER_ID}",
    "payingAgent": "${PAYING_AGENT_ID}",
    "id": "BOND-2026-01",
    "description": "GlobalCorp 5.0% 2Y Senior Note",
    "currency": "USD",
    "issuanceSize": "1000000.0",
    "faceValue": "1000.0",
    "couponRate": "0.05",
    "issueDate": "${ISSUE_DATE}",
    "maturityDate": "${MATURITY_DATE}",
    "paymentSchedule": ["${COUPON_DATE_1}", "${COUPON_DATE_2}"],
    "observers": []
  }
}
EOF
)

proposal_response=$(submit_command "${ISSUER_JWT}" "create" "${PROPOSAL_PAYLOAD}")
PROPOSAL_CID=$(echo "${proposal_response}" | jq -r '.result.contractId')
echo "  BondIssuanceProposal created with CID: ${PROPOSAL_CID}"
echo

echo "--- Step 2: Paying Agent accepts the proposal ---"
ACCEPT_PAYLOAD=$(cat <<EOF
{
  "templateId": "${PKG_ID}:Issuance.BondIssuanceProposal",
  "contractId": "${PROPOSAL_CID}",
  "choice": "Accept",
  "argument": {}
}
EOF
)

accept_response=$(submit_command "${PAYING_AGENT_JWT}" "exercise" "${ACCEPT_PAYLOAD}")
ISSUANCE_CID=$(echo "${accept_response}" | jq -r '.result.events[0].created.contractId')
echo "  Proposal accepted. BondIssuance created with CID: ${ISSUANCE_CID}"
echo

echo "--- Step 3: Investors subscribe to the bond ---"

echo "  Investor A subscribes for 50 units..."
SUB_A_PAYLOAD=$(cat <<EOF
{
  "templateId": "${PKG_ID}:Subscription.SubscriptionRequest",
  "payload": {
    "investor": "${INVESTOR_A_ID}",
    "issuer": "${ISSUER_ID}",
    "issuanceCid": "${ISSUANCE_CID}",
    "quantity": "50"
  }
}
EOF
)
sub_a_response=$(submit_command "${INVESTOR_A_JWT}" "create" "${SUB_A_PAYLOAD}")
SUB_A_CID=$(echo "${sub_a_response}" | jq -r '.result.contractId')
echo "    SubscriptionRequest A created with CID: ${SUB_A_CID}"

echo "  Investor B subscribes for 100 units..."
SUB_B_PAYLOAD=$(cat <<EOF
{
  "templateId": "${PKG_ID}:Subscription.SubscriptionRequest",
  "payload": {
    "investor": "${INVESTOR_B_ID}",
    "issuer": "${ISSUER_ID}",
    "issuanceCid": "${ISSUANCE_CID}",
    "quantity": "100"
  }
}
EOF
)
sub_b_response=$(submit_command "${INVESTOR_B_JWT}" "create" "${SUB_B_PAYLOAD}")
SUB_B_CID=$(echo "${sub_b_response}" | jq -r '.result.contractId')
echo "    SubscriptionRequest B created with CID: ${SUB_B_CID}"
echo

echo "--- Step 4: Issuer accepts subscriptions ---"

echo "  Accepting Investor A's subscription..."
ACCEPT_SUB_A_PAYLOAD=$(cat <<EOF
{
  "templateId": "${PKG_ID}:Subscription.SubscriptionRequest",
  "contractId": "${SUB_A_CID}",
  "choice": "Accept",
  "argument": {}
}
EOF
)
accept_sub_a_response=$(submit_command "${ISSUER_JWT}" "exercise" "${ACCEPT_SUB_A_PAYLOAD}")
HOLDING_A_CID=$(echo "${accept_sub_a_response}" | jq -r '.result.events[0].created.contractId')
echo "    Investor A's BondHolding created with CID: ${HOLDING_A_CID}"

echo "  Accepting Investor B's subscription..."
ACCEPT_SUB_B_PAYLOAD=$(cat <<EOF
{
  "templateId": "${PKG_ID}:Subscription.SubscriptionRequest",
  "contractId": "${SUB_B_CID}",
  "choice": "Accept",
  "argument": {}
}
EOF
)
accept_sub_b_response=$(submit_command "${ISSUER_JWT}" "exercise" "${ACCEPT_SUB_B_PAYLOAD}")
HOLDING_B_CID=$(echo "${accept_sub_b_response}" | jq -r '.result.events[0].created.contractId')
echo "    Investor B's BondHolding created with CID: ${HOLDING_B_CID}"
echo

echo "--- Bond Issuance Complete ---"
echo "Summary of created contracts:"
echo "  BondIssuance Contract: ${ISSUANCE_CID}"
echo "  Investor A Holding:    ${HOLDING_A_CID} (50 units)"
echo "  Investor B Holding:    ${HOLDING_B_CID} (100 units)"
echo "------------------------------"
echo "Workflow finished successfully."