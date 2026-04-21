import React, { useState, useEffect } from 'react';
import { DamlLedger, useParty, useLedger, useStreamQueries } from '@c7/react';
import { Bond } from './bondService'; // Assuming types are exported from here
import { BondCard } from './BondCard';
import { issueBond, subscribeToBond, payCoupon, redeemBond } from './bondService';
import './App.css';

// --- Type Definitions ---

type Credentials = {
  party: string;
  token: string;
};

// --- Helper Components ---

const LoginScreen: React.FC<{ onLogin: (creds: Credentials) => void }> = ({ onLogin }) => {
  const [party, setParty] = useState('');
  const [token, setToken] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (party && token) {
      onLogin({ party, token });
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2>Canton Bond Platform</h2>
        <p>Login with your Party ID and JWT Token</p>
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="party">Party ID</label>
            <input
              id="party"
              type="text"
              className="input-field"
              value={party}
              onChange={(e) => setParty(e.target.value)}
              placeholder="e.g., Alice::1220..."
            />
          </div>
          <div className="form-group">
            <label htmlFor="token">Auth Token (JWT)</label>
            <input
              id="token"
              type="password"
              className="input-field"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste your token here"
            />
          </div>
          <button type="submit" className="button button-primary">Login</button>
        </form>
      </div>
    </div>
  );
};

const NewBondForm: React.FC<{ onIssue: () => void }> = ({ onIssue }) => {
    const ledger = useLedger();
    const party = useParty();
    const [formData, setFormData] = useState({
      bondId: '',
      currency: 'USD',
      faceValue: '1000.0',
      couponRate: '0.05',
      maturityDate: '',
      paymentFrequencyMonths: '6',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSubmitting(true);
        try {
            const maturityDate = new Date(formData.maturityDate).toISOString().split('T')[0];
            await issueBond(ledger, {
                issuer: party,
                bondId: formData.bondId,
                currency: formData.currency,
                faceValue: formData.faceValue,
                couponRate: formData.couponRate,
                maturityDate: maturityDate,
                paymentFrequencyMonths: parseInt(formData.paymentFrequencyMonths)
            });
            onIssue(); // Callback to refresh or notify parent
            setFormData({ // Reset form
                bondId: '',
                currency: 'USD',
                faceValue: '1000.0',
                couponRate: '0.05',
                maturityDate: '',
                paymentFrequencyMonths: '6',
            });
        } catch (err: any) {
            setError(err.message || 'Failed to issue bond.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="form-container">
            <h3>Issue New Bond</h3>
            <form onSubmit={handleSubmit}>
                <div className="form-grid">
                    <div className="form-group">
                        <label>Bond ID / ISIN</label>
                        <input name="bondId" value={formData.bondId} onChange={handleChange} required />
                    </div>
                    <div className="form-group">
                        <label>Currency</label>
                        <input name="currency" value={formData.currency} onChange={handleChange} required />
                    </div>
                    <div className="form-group">
                        <label>Face Value</label>
                        <input type="number" name="faceValue" value={formData.faceValue} onChange={handleChange} required />
                    </div>
                    <div className="form-group">
                        <label>Coupon Rate (e.g., 0.05 for 5%)</label>
                        <input type="number" step="0.001" name="couponRate" value={formData.couponRate} onChange={handleChange} required />
                    </div>
                    <div className="form-group">
                        <label>Maturity Date</label>
                        <input type="date" name="maturityDate" value={formData.maturityDate} onChange={handleChange} required />
                    </div>
                    <div className="form-group">
                        <label>Payment Frequency (Months)</label>
                        <select name="paymentFrequencyMonths" value={formData.paymentFrequencyMonths} onChange={handleChange}>
                            <option value="3">Quarterly</option>
                            <option value="6">Semi-Annually</option>
                            <option value="12">Annually</option>
                        </select>
                    </div>
                </div>
                <button type="submit" className="button button-primary" disabled={isSubmitting}>
                    {isSubmitting ? 'Issuing...' : 'Issue Bond'}
                </button>
                {error && <p className="error-message">{error}</p>}
            </form>
        </div>
    );
};


// --- Main Application Components ---

const MainScreen: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const party = useParty();
  const ledger = useLedger();
  const [activeTab, setActiveTab] = useState('portfolio');

  const { contracts: bonds, loading: bondsLoading } = useStreamQueries(Bond);

  const myIssuedBonds = bonds.filter(b => b.payload.issuer === party);
  const myPortfolio = bonds.filter(b => b.payload.owner === party && b.payload.issuer !== party);
  const marketplaceBonds = bonds.filter(b => b.payload.owner === b.payload.issuer); // Bonds still held by issuer are available for subscription

  const handleAction = async (action: Promise<any>, successMessage: string) => {
    try {
      await action;
      alert(successMessage);
    } catch (err: any) {
      console.error(err);
      alert(`Action failed: ${err.message}`);
    }
  };

  const renderContent = () => {
    if (bondsLoading) {
      return <div className="loading">Loading contracts...</div>;
    }
    switch (activeTab) {
      case 'marketplace':
        return (
          <div className="card-grid">
            {marketplaceBonds.length > 0 ? marketplaceBonds.map(bond => (
              <BondCard
                key={bond.contractId}
                bond={bond.payload}
                actions={[{
                  label: 'Subscribe',
                  handler: () => handleAction(
                    subscribeToBond(ledger, bond.contractId),
                    'Successfully subscribed to bond!'
                  ),
                  condition: bond.payload.owner === bond.payload.issuer
                }]}
              />
            )) : <p>No new bonds available in the marketplace.</p>}
          </div>
        );
      case 'portfolio':
        return (
          <div className="card-grid">
            {myPortfolio.length > 0 ? myPortfolio.map(bond => (
              <BondCard
                key={bond.contractId}
                bond={bond.payload}
                isOwner={true}
                actions={[]} // Could add actions like 'Sell' in a future version
              />
            )) : <p>You do not own any bonds yet. Visit the Marketplace to subscribe.</p>}
          </div>
        );
      case 'issuer':
        return (
          <div>
            <NewBondForm onIssue={() => { /* Data will refetch automatically via streams */ }} />
            <h2 className="section-title">My Issued Bonds</h2>
            <div className="card-grid">
              {myIssuedBonds.length > 0 ? myIssuedBonds.map(bond => (
                <BondCard
                  key={bond.contractId}
                  bond={bond.payload}
                  isIssuer={true}
                  actions={[
                    {
                      label: `Pay Coupon (${bond.payload.currency} ${bond.payload.couponAmount})`,
                      handler: () => handleAction(
                        payCoupon(ledger, bond.contractId),
                        'Coupon payment dispatched!'
                      ),
                      condition: true // Add logic based on next payment date if needed
                    },
                    {
                      label: `Redeem Bond (${bond.payload.currency} ${bond.payload.faceValue})`,
                      handler: () => handleAction(
                        redeemBond(ledger, bond.contractId),
                        'Bond successfully redeemed!'
                      ),
                      condition: new Date() >= new Date(bond.payload.maturityDate)
                    }
                  ]}
                />
              )) : <p>You have not issued any bonds.</p>}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Canton Bond Platform</h1>
        <div className="header-right">
          <span className="party-info">Logged in as: <strong>{party}</strong></span>
          <button onClick={onLogout} className="button button-secondary">Logout</button>
        </div>
      </header>
      <nav className="app-nav">
        <button
          className={`nav-button ${activeTab === 'portfolio' ? 'active' : ''}`}
          onClick={() => setActiveTab('portfolio')}
        >
          My Portfolio
        </button>
        <button
          className={`nav-button ${activeTab === 'marketplace' ? 'active' : ''}`}
          onClick={() => setActiveTab('marketplace')}
        >
          Marketplace
        </button>
        <button
          className={`nav-button ${activeTab === 'issuer' ? 'active' : ''}`}
          onClick={() => setActiveTab('issuer')}
        >
          Issuer Dashboard
        </button>
      </nav>
      <main className="app-main">
        {renderContent()}
      </main>
    </div>
  );
};

const App: React.FC = () => {
  const [credentials, setCredentials] = useState<Credentials | null>(() => {
    const savedCreds = localStorage.getItem('daml.credentials');
    return savedCreds ? JSON.parse(savedCreds) : null;
  });

  useEffect(() => {
    if (credentials) {
      localStorage.setItem('daml.credentials', JSON.stringify(credentials));
    } else {
      localStorage.removeItem('daml.credentials');
    }
  }, [credentials]);

  const handleLogin = (creds: Credentials) => {
    setCredentials(creds);
  };

  const handleLogout = () => {
    setCredentials(null);
  };

  if (!credentials) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  const httpBaseUrl = process.env.REACT_APP_JSON_API_URL;

  return (
    <DamlLedger party={credentials.party} token={credentials.token} httpBaseUrl={httpBaseUrl}>
      <MainScreen onLogout={handleLogout} />
    </DamlLedger>
  );
};

export default App;