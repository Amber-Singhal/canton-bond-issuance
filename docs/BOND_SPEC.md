# Digital Bond Terms Specification

## 1. Overview

This document specifies the standard terms and lifecycle events for digital bonds issued and managed on the Canton network using the `canton-bond-issuance` Daml application. It serves as a bridge between the legal prospectus of a specific bond issuance and its technical implementation as a set of smart contracts.

The primary goal is to define a consistent data model and set of processes that can represent a wide variety of standard fixed-income instruments, ensuring clarity, interoperability, and automation.

## 2. Legal Wrapper and Disclaimer

The Daml smart contracts governed by this specification represent the authoritative digital record (the "golden source of truth") for the ownership and state of the bond units on the Canton network. However, the contracts themselves are subject to and governed by the terms outlined in the legally binding master agreement and the specific offering prospectus for each issuance.

In the event of any discrepancy or dispute, the terms of the legal prospectus shall prevail. The execution of choices on the Daml contracts constitutes legally binding actions as defined within the governing legal framework.

All parties interacting with these contracts (Issuers, Investors, Agents) must be permissioned onto the network and are bound by the network's operating rules and the terms of the specific bond issuance.

## 3. Core Bond Terms (Data Schema)

The following fields define the core attributes of a bond issuance. These parameters are set at the time of creation and are immutable throughout the bond's lifecycle.

| Field | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| `issuer` | `Party` | The legal entity issuing the bond and obligated to make payments. | "MegaCorp, Inc." |
| `bondId` | `Text` | A unique identifier for the bond series, typically an ISIN. | "US5801351017" |
| `description` | `Text` | A human-readable description of the instrument. | "MegaCorp 5.25% Senior Notes due 2034" |
| `currency` | `Text` | The ISO 4217 currency code for all payments. | "USD" |
| `faceValue` | `Decimal` | The nominal or par value of a single bond unit. | `1000.00` |
| `couponRate` | `Decimal` | The annual interest rate paid to bondholders, expressed as a decimal. | `0.0525` (for 5.25%) |
| `couponFrequency` | `Enum` | The frequency of coupon payments. | `SemiAnnually` (or `Annually`, `Quarterly`) |
| `issuanceDate` | `Date` | The date on which the bond is officially issued and begins to accrue interest. | `2024-08-15` |
| `maturityDate` | `Date` | The date on which the bond matures and the principal is repaid. | `2034-08-15` |
| `firstCouponDate`| `Date` | The date of the first coupon payment. | `2025-02-15` |
| `dayCountConvention` | `Enum` | The convention used to calculate accrued interest. | `Thirty360` (or `Actual365`, etc.) |
| `payingAgent` | `Party` | The financial institution responsible for disbursing coupon and principal payments. | "Global Payments Bank" |
| `registrar` | `Party` | The entity responsible for maintaining the definitive register of bondholders. | "Canton CSD Services" |
| `arrangers` | `[Party]`| The list of parties (investment banks) who structure and manage the initial sale. | `["Arranger Bank A", "Arranger Bank B"]` |

## 4. Lifecycle Events & Processes

The digital bond progresses through a series of well-defined lifecycle events, implemented as choices on the Daml contracts.

### 4.1. Pre-Issuance & Subscription

1.  **Instrument Definition**: The `Issuer`, in coordination with the `Arrangers`, creates a `BondInstrument` contract on the ledger. This contract contains all the immutable terms defined in Section 3 and serves as the master template for the issuance.
2.  **Subscription Window**: A subscription period is opened. During this time, permissioned `Investors` can submit `SubscriptionRequest` contracts, indicating their commitment to purchase a certain quantity of the bond at a specified price.
3.  **Allocation**: Upon closing the subscription window, the `Issuer` and `Arrangers` review the requests and create `BondAllocation` contracts for successful investors. This represents a binding agreement to deliver bonds against payment.
4.  **Settlement (DvP)**: On the `issuanceDate`, a coordinated Delivery-vs-Payment (DvP) settlement occurs. The `BondAllocation` contracts are exercised, atomically creating `BondHolding` contracts for the investor while simultaneously transferring payment (e.g., via a CIP-0056 token) from the investor to the issuer.

### 4.2. Coupon Payment

1.  **Calculation**: On each coupon payment date, the `PayingAgent` is responsible for calculating the amount owed to each bondholder based on their holdings. This calculation is deterministic based on the `couponRate`, `faceValue`, `dayCountConvention`, and quantity held.
2.  **Distribution**: The `PayingAgent` initiates a choice on each `BondHolding` contract to distribute the coupon payment. This is a one-to-many transaction where the agent transfers the correct coupon amount to each bondholder. The ledger ensures the atomicity and correctness of this distribution.
3.  **Record Keeping**: The exercise of the coupon payment choice immutably records the payment event in the contract's history.

### 4.3. Redemption at Maturity

1.  **Final Payment**: On the `maturityDate`, the `PayingAgent` is responsible for distributing the final payment, which includes both the last coupon payment and the full principal (`faceValue`).
2.  **Retirement**: The choice to redeem the bond atomically transfers the final payment to the bondholder and archives the `BondHolding` contract, signifying that the instrument has been fully repaid and retired from the ledger.

### 4.4. Secondary Market Transfer

Ownership of a `BondHolding` can be transferred between two permissioned investors. This is typically handled via a DvP process, similar to the initial settlement.

1.  **Offer**: The seller offers their `BondHolding` contract to a buyer.
2.  **Settlement**: The transfer is settled atomically. The `BondHolding` contract is archived, and a new `BondHolding` contract is created in the name of the buyer, while payment is simultaneously transferred from the buyer to the seller. This prevents settlement risk.

## 5. Party Roles & Responsibilities

| Role | Responsibilities |
| :--- | :--- |
| **Issuer** | - Defines bond terms. <br/> - Originates the debt obligation. <br/> - Makes principal and interest payments to the Paying Agent. |
| **Investor / Bondholder** | - Subscribes to the initial issuance. <br/> - Holds the `BondHolding` contract, representing a claim on the Issuer. <br/> - Receives coupon and principal payments. |
| **Paying Agent** | - Receives funds from the Issuer. <br/> - Distributes coupon and principal payments to the current bondholders as per the ledger record. |
| **Registrar / CSD** | - Observes all bond holdings and transfers. <br/> - Acts as the definitive source for the register of bondholders. In this model, the Canton ledger itself serves this function, with the Registrar party having observer rights on all relevant contracts. |
| **Arranger** | - Structures the bond issuance. <br/> - Manages the subscription and allocation process. |