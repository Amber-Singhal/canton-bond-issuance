import React from 'react';
import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Grid,
  Typography,
  Divider,
} from '@mui/material';
import { green, grey, blue } from '@mui/material/colors';

// This interface should align with the structure of the bond contract data
// fetched from the Daml ledger, likely via the JSON API and codegen types.
export interface BondData {
  contractId: string;
  payload: {
    isin: string;
    issuer: string;
    description: string;
    currency: string;
    faceValue: string; // Decimal as string
    couponRate: string; // Decimal as string
    maturityDate: string; // ISO Date string e.g., "2034-08-15"
    issuanceEndDate: string; // ISO Date string
    nextCouponDate?: string; // Optional, may not exist if matured
    // In a real-world scenario, YTM would be calculated by a pricing engine.
    // Here we assume it's provided for simplicity.
    yieldToMaturity: string;
  };
}

interface BondCardProps {
  bond: BondData;
  onSubscribe: (contractId: string) => void;
  onViewDetails: (contractId: string) => void;
}

// Helper to determine the bond's current lifecycle status
const getBondStatus = (issuanceEndDateStr: string, maturityDateStr: string): { label: 'Issuance' | 'Active' | 'Matured'; color: string } => {
  const now = new Date();
  const issuanceEndDate = new Date(issuanceEndDateStr);
  const maturityDate = new Date(maturityDateStr);
  
  // Set time to end of day for accurate date comparisons
  now.setHours(23, 59, 59, 999);
  issuanceEndDate.setHours(23, 59, 59, 999);
  maturityDate.setHours(23, 59, 59, 999);

  if (now.getTime() < issuanceEndDate.getTime()) {
    return { label: 'Issuance', color: blue[500] };
  } else if (now.getTime() < maturityDate.getTime()) {
    return { label: 'Active', color: green[500] };
  } else {
    return { label: 'Matured', color: grey[600] };
  }
};

const formatCurrency = (amount: string, currency: string) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount));
};

const formatPercent = (rate: string) => {
  return `${(Number(rate) * 100).toFixed(2)}%`;
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const BondCard: React.FC<BondCardProps> = ({ bond, onSubscribe, onViewDetails }) => {
  const { payload } = bond;
  const status = getBondStatus(payload.issuanceEndDate, payload.maturityDate);

  const handleActionClick = () => {
    if (status.label === 'Issuance') {
      onSubscribe(bond.contractId);
    } else {
      onViewDetails(bond.contractId);
    }
  };

  return (
    <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flexGrow: 1 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6" component="h2" noWrap>
            {payload.description}
          </Typography>
          <Chip label={status.label} sx={{ backgroundColor: status.color, color: 'white' }} size="small" />
        </Box>

        <Typography variant="body2" color="text.secondary" gutterBottom>
          ISIN: {payload.isin}
        </Typography>

        <Divider sx={{ my: 2 }} />

        <Grid container spacing={2}>
          <Grid item xs={6} sm={4}>
            <Typography variant="caption" color="text.secondary">Yield to Maturity</Typography>
            <Typography variant="body1" fontWeight="bold">{formatPercent(payload.yieldToMaturity)}</Typography>
          </Grid>
          <Grid item xs={6} sm={4}>
            <Typography variant="caption" color="text.secondary">Coupon Rate</Typography>
            <Typography variant="body1">{formatPercent(payload.couponRate)}</Typography>
          </Grid>
          <Grid item xs={6} sm={4}>
            <Typography variant="caption" color="text.secondary">Face Value</Typography>
            <Typography variant="body1">{formatCurrency(payload.faceValue, payload.currency)}</Typography>
          </Grid>
          <Grid item xs={6} sm={4}>
            <Typography variant="caption" color="text.secondary">Maturity</Typography>
            <Typography variant="body1">{formatDate(payload.maturityDate)}</Typography>
          </Grid>
          <Grid item xs={6} sm={8}>
            <Typography variant="caption" color="text.secondary">Next Coupon</Typography>
            <Typography variant="body1">
              {payload.nextCouponDate ? formatDate(payload.nextCouponDate) : 'N/A'}
            </Typography>
          </Grid>
        </Grid>

      </CardContent>
      <CardActions sx={{ borderTop: `1px solid ${grey[200]}`, p: 2 }}>
        <Button
          fullWidth
          variant="contained"
          onClick={handleActionClick}
          disabled={status.label === 'Matured'}
        >
          {status.label === 'Issuance' ? 'Subscribe' : 'View Details'}
        </Button>
      </CardActions>
    </Card>
  );
};

export default BondCard;