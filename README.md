# Canton Digital Bond Issuance Platform

[![CI](https://github.com/digital-asset/canton-bond-issuance/actions/workflows/ci.yml/badge.svg)](https://github.com/digital-asset/canton-bond-issuance/actions/workflows/ci.yml)

This project provides a complete, production-quality reference implementation for the lifecycle of a digital bond, built on the [Canton Network](https://www.canton.network/) using the [Daml](https://daml.com/) smart contract language.

It covers the entire workflow from issuance and subscription to periodic coupon payments and final redemption, demonstrating how distributed ledger technology can bring efficiency, transparency, and automation to capital markets.

## Table of Contents

- [Features](#features)
- [Bond Lifecycle Workflow](#bond-lifecycle-workflow)
- [Daml Model Architecture](#daml-model-architecture)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Automated Processes](#automated-processes)

## Features

- **Bond Instrument Definition**: Create and configure bond instruments with standard financial terms (e.g., ISIN, face value, coupon rate, maturity date, payment frequency).
- **Role-Based Permissions**: Clearly defined roles for all network participants: `Issuer`, `Investor`, `Central Securities Depository (CSD)`, and `Paying Agent`.
- **Subscription and Allocation**: A robust workflow for investors to subscribe to a new issuance during a defined window, followed by the issuer allocating bonds.
- **Automated Coupon Payments**: Logic for calculating and distributing periodic coupon payments to all current bondholders.
- **Atomic Settlement**: Utilizes Canton's atomic transaction model for Delivery-vs-Payment (DvP) during allocation and interest/principal payments.
- **Maturity and Redemption**: Handles the final principal repayment to bondholders at the bond's maturity date.
- **Optional Early Redemption**: A workflow for the issuer to propose an early redemption, which can be accepted by bondholders.
- **Privacy by Design**: Leverages Canton's privacy model, ensuring that only stakeholders to a specific contract can view its details.

## Bond Lifecycle Workflow

The platform models the following end-to-end process:

1.  **Setup & Onboarding**: The CSD onboards the Issuer, Paying Agent, and Investors by issuing them digitally signed `Role` contracts. These contracts govern their permissions and relationships on the platform.

2.  **Issuance Definition**: The Issuer, acting through the CSD, creates a `BondIssuance` contract. This contract contains all the immutable terms of the bond and serves as the single source of truth for the instrument.

3.  **Subscription Window**: The `BondIssuance` is published, opening a subscription window. Verified `Investors` can submit `SubscriptionRequest` contracts, signaling their intent to purchase a certain quantity of the bond.

4.  **Allocation & Settlement**: Once the subscription window closes, the Issuer reviews the requests and creates `Allocation` contracts for successful subscribers. The allocation process is settled atomically; the investor's cash is transferred to the issuer simultaneously with the `BondHolding` contract being issued to the investor (DvP).

5.  **Trading (Secondary Market)**: Post-issuance, `BondHolding` contracts can be transferred between investors, subject to the rules defined in the contracts.

6.  **Coupon Payments**: On each scheduled coupon date, the Paying Agent initiates a process that automatically calculates and distributes payments to the current owners of `BondHolding` contracts.

7.  **Redemption at Maturity**: On the bond's maturity date, the Issuer, via the Paying Agent, repays the principal amount to all final bondholders. The `BondHolding` contracts are then archived, concluding the lifecycle.

## Daml Model Architecture

The core logic is captured in a set of composable Daml templates:

-   `daml/Role.daml`: Defines the permissioning and relationship contracts for each participant (`IssuerRole`, `CSDRole`, `InvestorRole`, `PayingAgentRole`).
-   `daml/Instrument.daml`: Contains the `BondInstrument` template which defines the static, reusable terms of a bond.
-   `daml/Issuance.daml`: Defines the `BondIssuance` template, which represents a specific live issuance of a `BondInstrument`. It manages the subscription window and allocation process.
-   `daml/Subscription.daml`: Includes the `SubscriptionRequest` and `Allocation` templates used during the book-building phase.
-   `daml/Holding.daml`: The `BondHolding` template represents an investor's ownership of a specific quantity of the bond. This is the asset that is held and potentially traded.
-   `daml/Payment.daml`: Models the `CouponPaymentLifecycle` and `Redemption` processes, handling the calculation and disbursement of funds.
-   `daml/EarlyRedemption.daml`: Implements the optional workflow for an issuer-initiated early redemption of the bond.

## Prerequisites

-   **Canton (DPM)**: Version 3.4.0 or higher. [Installation Guide](https://docs.canton.io/3.4.0/user-manual/getting-started/download-and-install.html).
-   **Java**: JDK 11 or higher (required by the Canton sandbox).
-   **Node.js**: Version 18.x or higher, with `npm`.

## Getting Started

Follow these steps to build the project and run a local Canton ledger environment.

**1. Clone the Repository**

```bash
git clone https://github.com/digital-asset/canton-bond-issuance.git
cd canton-bond-issuance
```

**2. Build the Daml Models**

This command compiles the Daml code into a DAR (Daml Archive) file.

```bash
dpm build
```

The output will be located at `.daml/dist/canton-bond-issuance-0.1.0.dar`.

**3. Start the Canton Sandbox**

This command starts a local Canton ledger instance, exposing a gRPC port (`6865`) and a JSON API (`7575`).

```bash
dpm sandbox
```

The sandbox will remain running. Open a new terminal for the next steps.

**4. Run Tests & Initialize Ledger**

The Daml Script tests also serve to initialize the ledger with parties and example contracts, setting up a realistic scenario for the frontend UI.

```bash
dpm test
```

This script will:
- Allocate parties for the CSD, Issuer, Paying Agent, and several Investors.
- Create role contracts to establish relationships.
- Create a sample `BondIssuance` contract.
- Simulate investor subscriptions.

**5. Run the Frontend Application**

Navigate to the frontend directory, install dependencies, and start the local development server.

```bash
cd frontend
npm install
npm start
```

The application will be available at `http://localhost:3000`.

## Project Structure

```
.
├── daml/                        # All Daml smart contract code
│   ├── Bond.daml
│   ├── EarlyRedemption.daml
│   ├── Holding.daml
│   ├── Instrument.daml
│   ├── Issuance.daml
│   ├── Payment.daml
│   ├── Role.daml
│   ├── Subscription.daml
│   └── test/                    # Daml Script tests for automation and setup
│       ├── Main.daml
│       └── EarlyRedemptionTest.daml
├── frontend/                    # React-based user interface
│   ├── public/
│   ├── src/
│   ├── package.json
│   └── ...
├── .gitignore
├── daml.yaml                    # Daml package configuration
└── README.md
```

## Automated Processes

Workflows that run on a schedule, such as coupon payments, are ideal candidates for automation. This can be achieved using:

-   **Canton Triggers**: On-ledger, Daml-native automation rules that react to ledger events or time.
-   **External Automation Service**: An off-ledger service that connects to the ledger's JSON API or gRPC interface to submit transactions based on its own scheduler.

The Daml models in this project are designed to be compatible with both approaches. The `Payment.daml` module, for instance, contains choices that can be invoked by an automated agent to initiate the coupon payment cascade.