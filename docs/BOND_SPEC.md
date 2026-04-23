# Digital Bond Specification

## 1. Overview

This document specifies the terms and conditions for a digital bond issued, traded, and managed on the Canton Network. The lifecycle of the bond, from issuance to redemption, is automated through a set of Daml smart contracts. This specification serves as the primary reference for the functional and legal parameters encoded within these smart contracts.

The accompanying Daml code represents the technical implementation of the legally binding terms described herein.

## 2. Legal Framework and Disclaimer

This digital bond represents a debt obligation of the Issuer. The Daml smart contracts are designed to automate the execution of the terms outlined in the master bond indenture agreement, which constitutes the definitive legal agreement between the Issuer and the Bondholders.

In the event of any discrepancy or conflict between the behavior of the Daml smart contracts and the terms of the master bond indenture agreement, the master agreement shall prevail. The on-ledger state and transactions are intended to be a faithful, legally-binding representation of the rights and obligations of all parties.

The governance of the bond is subject to the laws and regulations of the specified jurisdiction.

## 3. Bond Terms - Key Parameters

The following table details the key parameters that define each bond issuance. These parameters are captured as data fields within the primary `Bond` Daml template.

| Parameter                  | Type              | Description                                                                                             | Example                                    |
| -------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| **Issuer**                 | `Party`           | The legal entity issuing the bond and obliged to make payments.                                         | "MegaCorp Inc."                            |
| **ISIN**                   | `Text`            | International Securities Identification Number, uniquely identifying the bond.                            | "US5801351017"                             |
| **Description**            | `Text`            | A short description of the bond.                                                                        | "5.0% Senior Unsecured Notes due 2030"     |
| **Currency**               | `Text`            | The currency in which the bond is denominated (ISO 4217 code).                                          | "USD"                                      |
| **Face Value (Par Value)** | `Decimal`         | The nominal value of a single bond unit, repaid at maturity.                                            | "1000.00"                                  |
| **Total Issuance Amount**  | `Decimal`         | The total principal amount of the bond issuance.                                                        | "100_000_000.00"                           |
| **Coupon Rate**            | `Decimal`         | The annual interest rate paid to bondholders, expressed as a decimal.                                   | "0.05" (for 5.0%)                          |
| **Coupon Frequency**       | `Enum`            | The frequency of coupon payments.                                                                       | `SemiAnnually`, `Annually`, `Quarterly`    |
| **Issuance Date**          | `Date`            | The date on which the bond is officially issued to investors.                                           | 2024-06-15                                 |
| **Maturity Date**          | `Date`            | The date on which the principal amount is due to be repaid to bondholders.                              | 2030-06-15                                 |
| **First Coupon Date**      | `Date`            | The date of the first coupon payment. Subsequent dates are calculated from here.                        | 2024-12-15                                 |
| **Day Count Convention**   | `Enum`            | The convention used to calculate accrued interest.                                                      | `Thirty360`, `Actual365Fixed`              |
| **Business Day Convention**| `Enum`            | Rules for adjusting payment dates that fall on non-business days.                                       | `Following`, `ModifiedFollowing`           |
| **Governing Law**          | `Text`            | The legal jurisdiction governing the bond agreement.                                                    | "State of New York, USA"                   |
| **Paying Agent**           | `Party`           | The financial institution responsible for processing coupon and principal payments.                     | "Global Custody Bank"                      |
| **Early Redemption**       | `Optional`        | Defines the terms for early redemption, if applicable. See `EarlyRedemption.daml`.                      | `Callable` (Issuer's option)               |

## 4. Lifecycle Events

The bond's lifecycle is managed through a series of on-ledger workflows, automated by choices on the Daml contracts.

### 4.1. Issuance and Subscription

1.  **Announcement:** The Issuer creates a `BondIssuance` contract, specifying all terms from the table above and defining the subscription window.
2.  **Subscription:** During the subscription window, eligible Investors can submit `SubscriptionRequest` contracts, indicating the amount they wish to purchase.
3.  **Allocation:** At the close of the subscription window, the Issuer and Paying Agent review requests. Upon receiving payment (via an off-ledger or DVP mechanism), the Paying Agent exercises a choice to allocate `BondHolding` contracts to the investors. Each `BondHolding` contract represents an investor's ownership of a specific quantity of the bond.

### 4.2. Coupon Payments

1.  **Calculation:** On each scheduled coupon payment date, the Paying Agent is prompted (e.g., by an automation trigger) to initiate the payment process.
2.  **Disbursement:** The Paying Agent exercises a `DisburseCoupon` choice on the central `Bond` contract. This atomically creates `CouponPayment` contracts for each registered Bondholder, representing the obligation to pay the calculated interest.
3.  **Settlement:** The `CouponPayment` contract is settled, typically via a Delivery-vs-Payment (DVP) process against a cash-equivalent token, transferring funds to the Bondholder and archiving the payment obligation.

### 4.3. Redemption at Maturity

1.  **Notification:** As the maturity date approaches, the system notifies the Issuer and Paying Agent of the upcoming principal repayment obligation.
2.  **Repayment:** On the maturity date, the Issuer funds the Paying Agent. The Paying Agent exercises a `Redeem` choice, which atomically transfers the principal amount to each Bondholder (again, typically via DVP) and archives their `BondHolding` contracts.
3.  **Archival:** Once all holdings have been redeemed, the master `Bond` contract is archived, concluding its lifecycle.

### 4.4. Early Redemption

If the bond includes early redemption provisions (e.g., a "callable" feature), the `EarlyRedemption` contract and its associated choices govern the process. This allows the Issuer to redeem the bond before its scheduled maturity date under predefined conditions, such as at a specific call price.

## 5. Parties and Roles

The following parties are involved in the digital bond lifecycle. Their permissions and actions are strictly enforced by the Daml smart contracts.

| Role           | On-Ledger Party        | Responsibilities                                                                                                 |
| -------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Issuer**     | `issuer: Party`        | The entity borrowing funds. Signatory of the master `Bond` contract; initiates the issuance process.               |
| **Paying Agent** | `payingAgent: Party`   | A trusted financial intermediary. Controller on choices for coupon disbursement, redemption, and bond allocation. |
| **Bondholder** | `investor: Party`      | The owner of a `BondHolding` contract. Receives coupon and principal payments; may participate in transfers.      |
| **Regulator**  | `regulator: Party` (Opt.) | An observer on key contracts for regulatory oversight and transparency, without control rights.                   |