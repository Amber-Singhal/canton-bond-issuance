# Canton Digital Bond Issuance Platform

[![CI](https://github.com/digital-asset/canton-bond-issuance/actions/workflows/ci.yml/badge.svg)](https://github.com/digital-asset/canton-bond-issuance/actions/workflows/ci.yml)

This project provides a reference implementation for the full lifecycle of a digital bond on the Canton Network, built using Daml smart contracts. It covers issuance, subscription by investors, periodic coupon payments, and final redemption at maturity.

The platform is designed to model the interactions between key financial market participants in a privacy-preserving, atomic, and auditable manner.

## Table of Contents

- [Core Concepts](#core-concepts)
- [Technology Stack](#technology-stack)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [User Onboarding Guide](#user-onboarding-guide)
  - [For Issuers](#for-issuers)
  - [For Investors](#for-investors)
  - [For the Paying Agent](#for-the-paying-agent)
- [Project Structure](#project-structure)
- [Daml Model Overview](#daml-model-overview)
- [Running Tests](#running-tests)

## Core Concepts

The application models a simplified bond market workflow with the following roles:

*   **CSD (Central Securities Depository)**: The central operator of the platform, responsible for onboarding other participants.
*   **Issuer**: An entity (e.g., a corporation or government) that creates and issues bonds to raise capital.
*   **Investor**: An entity that subscribes to and holds bonds, receiving coupon payments and principal at maturity.
*   **Paying Agent**: An entity, typically a bank appointed by the Issuer, responsible for disbursing coupon payments and the final redemption amount to bondholders.

The bond lifecycle proceeds through these stages:

1.  **Issuance**: The Issuer defines the bond's terms (ISIN, maturity date, coupon rate, etc.) and offers it on the platform.
2.  **Subscription**: Investors view the offering and submit `SubscriptionRequest`s to purchase a certain quantity of the bond.
3.  **Allocation**: The Issuer accepts subscription requests, and `BondHolding` contracts are atomically created for each investor.
4.  **Coupon Payments**: On predefined payment dates, the Paying Agent disburses coupon payments to all current bondholders.
5.  **Redemption**: At the bond's maturity date, the Paying Agent disburses the final principal amount to bondholders, and the bond contracts are archived.

## Technology Stack

*   **Smart Contracts**: [Daml](https://daml.com)
*   **Ledger**: [Canton Network](https://www.canton.io)
*   **Frontend**: React, TypeScript, [@c7/react](https://docs.daml.com/c7/c7-react/reference/index.html)
*   **Build Tool**: DPM (Digital Asset Package Manager)

## Prerequisites

1.  **DPM**: Ensure you have the Canton/Daml toolchain installed. Follow the instructions at [https://get.digitalasset.com](https://get.digitalasset.com).
    ```bash
    curl https://get.digitalasset.com/install/install.sh | sh
    ```
2.  **Node.js**: Version 18.x or later.
3.  **jq**: A command-line JSON processor. ([Download](https://jqlang.github.io/jq/download/))

## Getting Started

Follow these steps to run the application locally.

**1. Clone the Repository**
```bash
git clone https://github.com/digital-asset/canton-bond-issuance.git
cd canton-bond-issuance
```

**2. Build the Daml Models**
This compiles your Daml code into a DAR (Daml Archive) file.
```bash
dpm build
```
The output will be in `.daml/dist/canton-bond-issuance-0.1.0.dar`.

**3. Start the Local Canton Ledger**
This command starts a local Canton sandbox environment, including a participant node and the JSON API server.
```bash
dpm sandbox
```
Leave this process running in a terminal window. The JSON API will be available at `http://localhost:7575`.

**4. Generate TypeScript Code**
From a new terminal, generate TypeScript bindings from your DAR file for the frontend.
```bash
dpm codegen-js
```

**5. Install Frontend Dependencies**
```bash
cd frontend
npm install
```

**6. Run the Initialization Script**
This script allocates the necessary parties (CSD, Issuer, Investors, etc.) on the ledger and creates the initial CSD role contract.
```bash
npm run init-script
```
The script will create a `.env` file containing the party identifiers for the UI.

**7. Start the Frontend Application**
```bash
npm start
```
Your browser should open to `http://localhost:3000`, where you can interact with the application.

## User Onboarding Guide

The UI includes a login dropdown in the top right corner. Select a role to view the ledger from that party's perspective.

### For Issuers

1.  **Log in**: Select `ACME_Corporation::...` (the Issuer) from the dropdown.
2.  **Create New Issuance**: Click the "Create New Bond Issuance" button.
3.  **Fill Details**: Complete the form with the bond's specifications, as outlined in `docs/BOND_SPEC.md`. This includes ISIN, face value, coupon rate, payment dates, etc.
4.  **Submit**: Submitting the form creates a `BondIssuance` contract proposal, which the CSD must approve.
5.  **View Subscriptions**: Once approved and live, you can view incoming subscription requests from investors on your dashboard and choose to accept them.

### For Investors

1.  **Log in**: Select `Investor_Alice::...` or `Investor_Bob::...` from the dropdown.
2.  **Browse Issuances**: The main dashboard shows all active bond issuances you are invited to.
3.  **Subscribe**: Click "Subscribe" on a bond you are interested in.
4.  **Enter Amount**: Specify the quantity of bonds you wish to purchase and submit. This creates a `SubscriptionRequest` contract.
5.  **View Holdings**: Once the Issuer accepts your request, a `BondHolding` contract will appear on your dashboard. You will see scheduled coupon payments and receive them automatically on the due dates.

### For the Paying Agent

1.  **Log in**: Select `Global_Payments_Inc::...` (the Paying Agent) from the dropdown.
2.  **View Obligations**: Your dashboard lists all bonds for which you are the designated paying agent.
3.  **Process Payments**: The dashboard shows upcoming coupon and redemption payment obligations. In a production system, this would be automated. In this reference app, you can manually trigger the `ProcessCouponPayment` or `ProcessRedemption` choices to simulate disbursement. This demonstrates the atomic settlement of payments to all bondholders.

## Project Structure

```
.
├── daml/                      # Daml smart contract source code
│   └── Bond/
│       ├── Holding.daml       # BondHolding and related contracts
│       ├── Issuance.daml      # BondIssuance contract for offerings
│       └── Roles.daml         # Participant role contracts
├── frontend/                  # React/TypeScript frontend application
│   ├── src/
│   ├── package.json
│   └── ...
├── .github/                   # GitHub Actions CI configuration
│   └── workflows/
│       └── ci.yml
├── docs/                      # Project documentation
│   └── BOND_SPEC.md
├── daml.yaml                  # Daml project configuration
├── README.md                  # This file
└── ...
```

## Daml Model Overview

The core logic is captured in a set of Daml templates:

*   **`Roles.Daml.CsdRole`**: A contract establishing the CSD's authority on the platform.
*   **`Roles.Daml.IssuerRole`**: Grants an Issuer the right to propose new bond issuances.
*   **`Issuance.Daml.BondIssuanceProposal`**: An Issuer's request to create a new bond. Must be approved by the CSD.
*   **`Issuance.Daml.BondIssuance`**: The active bond offering contract, visible to invited investors.
*   **`Issuance.Daml.SubscriptionRequest`**: An Investor's request to purchase a specific quantity of a bond.
*   **`Holding.Daml.BondHolding`**: Represents an investor's ownership of a bond. This is the primary instrument that receives payments.
*   **`Holding.Daml.CouponPayment`**: A contract representing a single, scheduled coupon payment obligation from the Paying Agent to a `BondHolding` owner.
*   **`Holding.Daml.Redemption`**: A contract representing the final principal repayment obligation.

## Running Tests

The project includes Daml Script tests to verify the contract logic. To run them:

```bash
dpm test
```