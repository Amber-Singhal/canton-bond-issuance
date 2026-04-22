// Copyright (c) 2024 Digital Asset (Switzerland) GmbH and/or its affiliates. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import React, { useMemo } from 'react';
import { addMonths, isBefore, format, parseISO } from 'date-fns';

/**
 * Props for the CouponSchedule component.
 * These properties define the bond for which the coupon schedule is calculated.
 */
export interface CouponScheduleProps {
  /** The date the bond was issued, in ISO 8601 format (e.g., "2024-01-15"). */
  issuanceDate: string;
  /** The date the bond matures, in ISO 8601 format (e.g., "2029-01-15"). */
  maturityDate: string;
  /** The annual coupon rate as a decimal string (e.g., "0.05" for 5%). */
  couponRate: string;
  /** The frequency of coupon payments. */
  couponFrequency: 'Annually' | 'SemiAnnually' | 'Quarterly' | 'Monthly';
  /** The face value (or principal) of the bond as a decimal string. */
  faceValue: string;
  /** The currency of the bond payments (e.g., "USD", "EUR"). */
  currency: string;
}

/** Represents a single calculated coupon payment. */
interface CouponPayment {
  paymentDate: Date;
  amount: number;
}

/**
 * Returns the number of payments per year and the month increment
 * for a given payment frequency.
 * @param frequency The coupon payment frequency.
 * @returns An object with paymentsPerYear and monthIncrement.
 */
const getPaymentInfo = (frequency: CouponScheduleProps['couponFrequency']): { paymentsPerYear: number; monthIncrement: number } => {
  switch (frequency) {
    case 'Annually':
      return { paymentsPerYear: 1, monthIncrement: 12 };
    case 'SemiAnnually':
      return { paymentsPerYear: 2, monthIncrement: 6 };
    case 'Quarterly':
      return { paymentsPerYear: 4, monthIncrement: 3 };
    case 'Monthly':
      return { paymentsPerYear: 12, monthIncrement: 1 };
    default:
      // This case should be unreachable due to TypeScript's type checking
      throw new Error(`Invalid coupon frequency: ${frequency}`);
  }
};

/**
 * Calculates the full schedule of coupon payments for a bond.
 * @param props The bond properties.
 * @returns An array of CouponPayment objects, or an empty array if inputs are invalid.
 */
const calculateCouponSchedule = ({
  issuanceDate,
  maturityDate,
  couponRate,
  couponFrequency,
  faceValue,
}: CouponScheduleProps): CouponPayment[] => {
  try {
    const parsedIssuanceDate = parseISO(issuanceDate);
    const parsedMaturityDate = parseISO(maturityDate);
    const numFaceValue = parseFloat(faceValue);
    const numCouponRate = parseFloat(couponRate);

    // Validate parsed inputs
    if (isNaN(parsedIssuanceDate.getTime()) || isNaN(parsedMaturityDate.getTime()) || isNaN(numFaceValue) || isNaN(numCouponRate)) {
      console.error("Invalid props for coupon schedule calculation: one or more values could not be parsed.", { issuanceDate, maturityDate, faceValue, couponRate });
      return [];
    }

    const { paymentsPerYear, monthIncrement } = getPaymentInfo(couponFrequency);
    const couponAmount = (numFaceValue * numCouponRate) / paymentsPerYear;

    const schedule: CouponPayment[] = [];
    let nextPaymentDate = addMonths(parsedIssuanceDate, monthIncrement);

    // Loop from the first payment date until the maturity date
    while (isBefore(nextPaymentDate, parsedMaturityDate) || nextPaymentDate.getTime() === parsedMaturityDate.getTime()) {
      schedule.push({
        paymentDate: nextPaymentDate,
        amount: couponAmount,
      });
      nextPaymentDate = addMonths(nextPaymentDate, monthIncrement);
    }

    return schedule;
  } catch (error) {
    console.error("Error calculating coupon schedule:", error);
    return [];
  }
};

/**
 * A React component to display the calculated coupon payment schedule for a bond.
 * It takes bond parameters as props and renders a table of payment dates and amounts.
 * Styling is applied via BEM-style CSS classes, which are expected to be defined
 * in a corresponding stylesheet (e.g., CouponSchedule.css).
 *
 * This component requires the `date-fns` library for robust date calculations.
 */
const CouponSchedule: React.FC<CouponScheduleProps> = (props) => {
  const schedule = useMemo(() => calculateCouponSchedule(props), [
    props.issuanceDate,
    props.maturityDate,
    props.couponRate,
    props.couponFrequency,
    props.faceValue,
  ]);

  if (schedule.length === 0) {
    return (
      <div className="coupon-schedule coupon-schedule--empty">
        <p>No coupon payments scheduled for this bond.</p>
      </div>
    );
  }

  // Use Intl.NumberFormat for robust, locale-aware currency formatting
  const currencyFormatter = new Intl.NumberFormat(navigator.language, {
    style: 'currency',
    currency: props.currency,
  });

  return (
    <div className="coupon-schedule">
      <h4 className="coupon-schedule__title">Coupon Payment Schedule</h4>
      <table className="coupon-schedule__table">
        <thead>
          <tr>
            <th scope="col">Payment Date</th>
            <th scope="col">Coupon Amount</th>
          </tr>
        </thead>
        <tbody>
          {schedule.map((payment, index) => (
            <tr key={index} className="coupon-schedule__row">
              <td className="coupon-schedule__cell">{format(payment.paymentDate, 'MMMM d, yyyy')}</td>
              <td className="coupon-schedule__cell coupon-schedule__cell--amount">
                {currencyFormatter.format(payment.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default CouponSchedule;