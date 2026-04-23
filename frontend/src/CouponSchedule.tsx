import React, { useMemo } from 'react';

/**
 * Props for the CouponSchedule component.
 * These values typically come from a Bond template contract on the ledger.
 */
export interface CouponScheduleProps {
  /** The total principal amount of the bond, e.g., "1000000.00". */
  principal: string;
  /** The annual coupon rate as a decimal string, e.g., "0.05" for 5%. */
  couponRate: string;
  /** How often coupons are paid. */
  couponFrequency: 'Annually' | 'SemiAnnually' | 'Quarterly' | 'Monthly';
  /** The date the bond was issued, in ISO 8601 format (e.g., "2023-01-01T00:00:00Z"). */
  issueDate: string;
  /** The date the bond matures, in ISO 8601 format. */
  maturityDate: string;
  /** The currency symbol to display, defaults to 'USD'. */
  currency?: string;
}

/**
 * Represents a single calculated coupon payment in the schedule.
 */
type CouponPayment = {
  paymentDate: Date;
  amount: number;
};

/**
 * A React component that calculates and displays a bond's coupon payment schedule.
 * It takes bond parameters as props and renders a clear, formatted table of
 * upcoming coupon payments.
 */
const CouponSchedule: React.FC<CouponScheduleProps> = ({
  principal,
  couponRate,
  couponFrequency,
  issueDate,
  maturityDate,
  currency = 'USD',
}) => {

  const schedule: CouponPayment[] = useMemo(() => {
    const p = parseFloat(principal);
    const r = parseFloat(couponRate);
    const start = new Date(issueDate);
    const end = new Date(maturityDate);

    // Validate inputs to ensure calculations are safe
    if (isNaN(p) || isNaN(r) || isNaN(start.getTime()) || isNaN(end.getTime()) || p <= 0 || r < 0) {
      return [];
    }

    let paymentsPerYear: number;
    switch (couponFrequency) {
      case 'Annually':
        paymentsPerYear = 1;
        break;
      case 'SemiAnnually':
        paymentsPerYear = 2;
        break;
      case 'Quarterly':
        paymentsPerYear = 4;
        break;
      case 'Monthly':
        paymentsPerYear = 12;
        break;
      default:
        // This case should be unreachable with TypeScript's type checking
        return [];
    }

    const couponAmount = (p * r) / paymentsPerYear;
    if (couponAmount <= 0) {
        return [];
    }

    const monthsIncrement = 12 / paymentsPerYear;
    const payments: CouponPayment[] = [];
    
    // Start calculating from the first payment date, which is one period after the issue date.
    let currentPaymentDate = new Date(start);
    currentPaymentDate.setMonth(currentPaymentDate.getMonth() + monthsIncrement);

    // Generate payments as long as they are on or before the maturity date.
    while (currentPaymentDate.getTime() <= end.getTime()) {
      payments.push({
        paymentDate: new Date(currentPaymentDate), // Clone date to avoid mutation issues
        amount: couponAmount,
      });
      currentPaymentDate.setMonth(currentPaymentDate.getMonth() + monthsIncrement);
    }

    return payments;
  }, [principal, couponRate, couponFrequency, issueDate, maturityDate]);

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  return (
    <div className="coupon-schedule-container">
      <h3 className="schedule-title">Coupon Payment Schedule</h3>
      {schedule.length === 0 ? (
        <p className="no-schedule-message">No coupon payments scheduled based on the provided bond details.</p>
      ) : (
        <div className="table-responsive">
          <table className="coupon-schedule-table">
            <thead>
              <tr>
                <th>Payment Date</th>
                <th>Coupon Amount</th>
              </tr>
            </thead>
            <tbody>
              {schedule.map((payment, index) => (
                <tr key={index}>
                  <td>{formatDate(payment.paymentDate)}</td>
                  <td className="amount-cell">{formatCurrency(payment.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <style jsx>{`
        .coupon-schedule-container {
          background-color: #f7f9fc;
          border: 1px solid #e0e6ed;
          border-radius: 8px;
          padding: 1.5rem;
          margin-top: 1rem;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        }
        .schedule-title {
          margin-top: 0;
          margin-bottom: 1rem;
          font-size: 1.25rem;
          color: #1c2a4e;
        }
        .no-schedule-message {
          color: #555;
          font-style: italic;
        }
        .table-responsive {
          overflow-x: auto;
        }
        .coupon-schedule-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.95rem;
        }
        .coupon-schedule-table th,
        .coupon-schedule-table td {
          padding: 0.75rem 1rem;
          text-align: left;
          border-bottom: 1px solid #e0e6ed;
        }
        .coupon-schedule-table th {
          background-color: #e8eef6;
          color: #334d6e;
          font-weight: 600;
          text-transform: uppercase;
          font-size: 0.8rem;
          letter-spacing: 0.05em;
        }
        .coupon-schedule-table tr:last-child td {
          border-bottom: none;
        }
        .coupon-schedule-table tbody tr:hover {
          background-color: #f0f4f9;
        }
        .amount-cell {
          text-align: right;
          font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
          font-weight: 500;
          color: #27ae60;
        }
      `}</style>
    </div>
  );
};

export default CouponSchedule;