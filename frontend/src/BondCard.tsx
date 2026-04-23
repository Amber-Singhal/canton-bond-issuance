import React from 'react';
import { format, isAfter } from 'date-fns';
import { CouponSchedule } from './CouponSchedule';

// --- Type Definitions (mirroring Daml templates) ---

/**
 * Represents the status of the bond throughout its lifecycle.
 */
export type BondStatus = "Issuing" | "Active" | "Redeemed";

/**
 * Represents the data payload of a bond contract on the ledger.
 * Fields are strings as they come from the JSON API.
 */
export interface Bond {
  isin: string;
  description: string;
  currency: string;
  faceValue: string;      // Daml Decimal as string
  couponRate: string;     // Daml Decimal as string
  maturityDate: string;   // Daml Date as string "YYYY-MM-DD"
  couponDates: string[];  // Array of Daml Dates as strings
  status: BondStatus;
}

// --- Props Interface ---

interface BondCardProps {
  bond: Bond;
}

// --- Helper Functions ---

/**
 * Finds the next upcoming coupon date from a list of dates.
 * @param couponDates - An array of date strings in "YYYY-MM-DD" format.
 * @param status - The current status of the bond.
 * @returns The next coupon date as a string, or null if none are upcoming or the bond is not active.
 */
const getNextCouponDate = (couponDates: string[], status: BondStatus): string | null => {
  if (status !== 'Active') {
    return null;
  }
  const now = new Date();
  // Ensure we compare dates only, ignoring time part
  now.setHours(0, 0, 0, 0);

  const futureDates = couponDates
    .map(dateStr => new Date(dateStr))
    .filter(date => isAfter(date, now) || date.getTime() === now.getTime()) // Include today
    .sort((a, b) => a.getTime() - b.getTime());

  return futureDates.length > 0 ? format(futureDates[0], 'yyyy-MM-dd') : null;
};

/**
 * Formats a numeric string as a currency value.
 */
const formatCurrency = (amount: string, currency: string) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount));
};

/**
 * Formats a rate string (e.g., "0.0525") as a percentage.
 */
const formatPercent = (rate: string) => {
  return `${(Number(rate) * 100).toFixed(2)}%`;
};

// --- Sub-components ---

const StatusTag: React.FC<{ status: BondStatus }> = ({ status }) => {
  const statusStyles: Record<BondStatus, string> = {
    Issuing: 'bg-blue-100 text-blue-800 border-blue-200',
    Active: 'bg-green-100 text-green-800 border-green-200',
    Redeemed: 'bg-gray-100 text-gray-800 border-gray-200',
  };

  return (
    <span
      className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${statusStyles[status]}`}
    >
      {status.toUpperCase()}
    </span>
  );
};

interface MetricProps {
  label: string;
  value: string;
}

const Metric: React.FC<MetricProps> = ({ label, value }) => (
  <div>
    <p className="text-sm text-gray-500">{label}</p>
    <p className="text-lg font-semibold text-gray-900">{value}</p>
  </div>
);


// --- Main Component ---

/**
 * A card component that displays the key details of a digital bond.
 */
export const BondCard: React.FC<BondCardProps> = ({ bond }) => {
  const {
    isin,
    description,
    currency,
    faceValue,
    couponRate,
    maturityDate,
    couponDates,
    status,
  } = bond;

  const nextCouponDate = getNextCouponDate(couponDates, status);

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 max-w-2xl mx-auto my-4 transition-shadow hover:shadow-lg">
      <header className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">{description}</h2>
          <p className="text-sm text-gray-500 font-mono tracking-wider">{isin}</p>
        </div>
        <StatusTag status={status} />
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-y-4 gap-x-6 mb-6 border-t border-b border-gray-200 py-4">
        <Metric label="Face Value" value={formatCurrency(faceValue, currency)} />
        <Metric label="Coupon Yield" value={formatPercent(couponRate)} />
        <Metric label="Maturity" value={format(new Date(maturityDate), 'dd MMM yyyy')} />
        <Metric
          label="Next Coupon"
          value={nextCouponDate ? format(new Date(nextCouponDate), 'dd MMM yyyy') : 'N/A'}
        />
      </section>

      <section>
        <h3 className="text-md font-semibold text-gray-700 mb-2">Coupon Payment Schedule</h3>
        <CouponSchedule couponDates={couponDates} />
      </section>
    </div>
  );
};

export default BondCard;