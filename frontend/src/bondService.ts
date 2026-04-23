/**
 * @module bondService
 * @description
 * This module provides a service layer for interacting with the Daml ledger
 * for bond-related contract queries. It abstracts the raw ledger API calls
 * into domain-specific functions for fetching bond holdings, instruments,
 * and coupon payments.
 */

import { Contract, ContractId, Ledger, Party } from '@c7/ledger';
import {
  Bond,
  Coupon
} from './daml.js/canton-bond-issuance-0.1.0/lib/index.js';

// --- Type Definitions ---

/**
 * A composite type that combines a Bond.Holding contract with its
 * corresponding Bond.Instrument contract details. This is useful for UI
 * components that need to display information from both contracts.
 */
export interface EnrichedHolding {
  holding: Contract<Bond.Holding>;
  instrument: Contract<Bond.Instrument>;
}

// --- Service Functions ---

/**
 * Fetches all active bond holdings for a given party and enriches them
 * with their corresponding instrument details.
 *
 * @param ledger - The Ledger instance to connect to the JSON API.
 * @param party - The party (e.g., investor) for whom to fetch bond holdings.
 * @returns A promise that resolves to an array of enriched bond holdings.
 */
export const getEnrichedHoldings = async (
  ledger: Ledger,
  party: Party
): Promise<EnrichedHolding[]> => {
  // Query for all Bond.Holding contracts where the given party is the investor.
  const holdings = await ledger.query(Bond.Holding, { investor: party });

  // For each holding, we need to fetch the full Bond.Instrument contract
  // which contains the detailed terms of the bond (e.g., coupon rate, maturity).
  const enrichedHoldings = await Promise.all(
    holdings.map(async (holding) => {
      const instrument = await ledger.fetch(Bond.Instrument, holding.payload.instrumentCid);

      // In a consistent ledger state, the instrument should always be found.
      // If not, it indicates a potential issue or a race condition where the
      // instrument was archived after the holding was fetched.
      if (!instrument) {
        console.error(`Could not find Bond.Instrument with CID ${holding.payload.instrumentCid} for holding ${holding.contractId}`);
        throw new Error(`Inconsistent data: Bond.Instrument not found for an active Bond.Holding.`);
      }

      return { holding, instrument };
    })
  );

  return enrichedHoldings;
};

/**
 * Fetches all coupon payment contracts associated with a specific bond holding.
 * This is useful for displaying the payment schedule for a single investment.
 *
 * @param ledger - The Ledger instance.
 * @param party - The party (investor) who is a stakeholder on the coupons.
 * @param holdingCid - The ContractId of the Bond.Holding to fetch coupons for.
 * @returns A promise that resolves to an array of Coupon contracts, sorted by payment date.
 */
export const getCouponsForHolding = async (
  ledger: Ledger,
  party: Party,
  holdingCid: ContractId<Bond.Holding>
): Promise<Contract<Coupon.Coupon>[]> => {
  // This query assumes the Coupon.Coupon template has a `holdingCid` field
  // that links it back to the parent Bond.Holding contract.
  const coupons = await ledger.query(Coupon.Coupon, {
    investor: party,
    holdingCid: holdingCid
  });

  // Sort coupons by payment date for predictable display.
  coupons.sort((a, b) =>
    new Date(a.payload.paymentDate).getTime() - new Date(b.payload.paymentDate).getTime()
  );

  return coupons;
};

/**
 * A generic function to fetch all coupon payment contracts for a given party across
 * all their bond holdings. This can be useful for an aggregated cash flow view.
 *
 * @param ledger - The Ledger instance.
 * @param party - The party (investor) for whom to fetch all coupons.
 * @returns A promise that resolves to an array of all Coupon contracts for the party, sorted by payment date.
 */
export const getAllCouponsForParty = async (
  ledger: Ledger,
  party: Party
): Promise<Contract<Coupon.Coupon>[]> => {
  const coupons = await ledger.query(Coupon.Coupon, { investor: party });

  // Sort coupons by payment date for a chronological view of upcoming payments.
  coupons.sort((a, b) =>
    new Date(a.payload.paymentDate).getTime() - new Date(b.payload.paymentDate).getTime()
  );

  return coupons;
};

/**
 * Fetches a single Bond.Instrument contract by its Contract ID.
 *
 * @param ledger - The Ledger instance.
 * @param instrumentCid - The ContractId of the Bond.Instrument to fetch.
 * @returns A promise that resolves to the Bond.Instrument contract, or null if not found.
 */
export const getInstrumentById = async (
  ledger: Ledger,
  instrumentCid: ContractId<Bond.Instrument>
): Promise<Contract<Bond.Instrument> | null> => {
  return ledger.fetch(Bond.Instrument, instrumentCid);
};