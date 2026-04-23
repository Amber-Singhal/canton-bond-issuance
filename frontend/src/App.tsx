import React, { useState, useMemo } from 'react';
import { DamlLedger, useParty, useLedger, useStreamQueries } from '@c7/react';
// These imports assume codegen has been run for a package named 'canton-bond-issuance'
// containing a module named 'Bond'.
// Run `dpm codegen-js` to generate these types.
import { Bond, Issuance } from '@canton-bond-issuance/daml-codegen/dist/Bond';
import { Party } from '@daml/types';

/**
 * Generates a dummy JWT for local development against a sandbox.
 * In a production environment, this would be replaced by a proper authentication flow
 * (e.g., OAuth2, OpenID Connect, or CIP-0103 for wallet integration) that provides a valid token.
 * @param party The party ID to embed in the token.
 * @returns A JWT string with actAs and readAs claims for the given party.
 */
const generateToken = (party: Party): string => {
  const payload = {
    "https://daml.com/ledger-api": {
      "ledgerId": "sandbox", // This should match your ledger's ID
      "applicationId": "canton-bond-issuance-app",
      "actAs": [party],
      "readAs": [party]
    }
  };
  const header = window.btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const body = window.btoa(JSON.stringify(payload));
  return `${header}.${body}.`;
};

// --- React Components ---

const LoginScreen: React.FC<{ onLogin: (party: Party, token: string) => void }> = ({ onLogin }) => {
  const [partyId, setPartyId] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (partyId.trim() === '') {
      alert('Please enter a Party ID');
      return;
    }
    const token = generateToken(partyId);
    onLogin(partyId, token);
  };

  return (
    <div style={styles.loginContainer}>
      <h2>Bond Issuance & Management Dashboard</h2>
      <form onSubmit={handleLogin} style={styles.loginForm}>
        <input
          type="text"
          placeholder="Enter Party ID (e.g., Issuer, Investor1)"
          value={partyId}
          onChange={(e) => setPartyId(e.target.value)}
          style={styles.input}
        />
        <button type="submit" style={styles.button}>Login</button>
      </form>
    </div>
  );
};

const MainView: React.FC = () => {
  const party = useParty();
  const ledger = useLedger();
  const { contracts: bonds, loading: bondsLoading } = useStreamQueries(Bond);
  const { contracts: issuances, loading: issuancesLoading } = useStreamQueries(Issuance);

  const [showIssuanceForm, setShowIssuanceForm] = useState(false);

  const handleSubscribe = async (issuanceCid: string, amount: string) => {
    const faceValue = parseFloat(amount);
    if (isNaN(faceValue) || faceValue <= 0) {
      alert("Please enter a valid subscription amount.");
      return;
    }
    try {
      await ledger.exercise(Issuance.Subscribe, issuanceCid, { faceValue: faceValue.toFixed(10) });
      alert("Subscription successful!");
    } catch (error) {
      console.error("Subscription failed:", error);
      alert(`Subscription failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  return (
    <div style={styles.mainContainer}>
      <header style={styles.header}>
        <h1>Bond Dashboard</h1>
        <div>
          <span>Logged in as: <strong>{party}</strong></span>
          <button onClick={() => setShowIssuanceForm(!showIssuanceForm)} style={{...styles.button, marginLeft: '20px'}}>
            {showIssuanceForm ? 'Close Issuance Form' : 'Create New Bond Issuance'}
          </button>
        </div>
      </header>

      {showIssuanceForm && <BondIssuanceForm onClose={() => setShowIssuanceForm(false)} />}

      <section style={styles.section}>
        <h2>My Bond Portfolio</h2>
        {bondsLoading ? <p>Loading portfolio...</p> : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>ISIN</th>
                <th style={styles.th}>Issuer</th>
                <th style={styles.th}>Face Value</th>
                <th style={styles.th}>Coupon Rate</th>
                <th style={styles.th}>Maturity Date</th>
              </tr>
            </thead>
            <tbody>
              {bonds.length === 0 ? (
                <tr><td colSpan={5} style={styles.td}>No bonds in portfolio.</td></tr>
              ) : bonds.map(bond => (
                <tr key={bond.contractId}>
                  <td style={styles.td}>{bond.payload.isin}</td>
                  <td style={styles.td}>{bond.payload.issuer}</td>
                  <td style={styles.td}>{parseFloat(bond.payload.faceValue).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td style={styles.td}>{(parseFloat(bond.payload.couponRate) * 100).toFixed(2)}%</td>
                  <td style={styles.td}>{bond.payload.maturityDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section style={styles.section}>
        <h2>Available Bond Issuances</h2>
        {issuancesLoading ? <p>Loading issuances...</p> : (
          <div style={styles.issuanceList}>
            {issuances.length === 0 ? (
              <p>No active bond issuances available for subscription.</p>
            ) : issuances.map(issuance => (
              <div key={issuance.contractId} style={styles.issuanceCard}>
                <h3>{issuance.payload.isin}</h3>
                <p><strong>Issuer:</strong> {issuance.payload.issuer}</p>
                <p><strong>Total Size:</strong> {parseFloat(issuance.payload.issueSize).toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                <p><strong>Subscribed:</strong> {parseFloat(issuance.payload.subscribedAmount).toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                <p><strong>Coupon:</strong> {(parseFloat(issuance.payload.couponRate) * 100).toFixed(2)}%</p>
                <p><strong>Maturity:</strong> {issuance.payload.maturityDate}</p>
                <form onSubmit={(e) => {
                    e.preventDefault();
                    const amount = (e.currentTarget.elements.namedItem('amount') as HTMLInputElement).value;
                    handleSubscribe(issuance.contractId, amount);
                }}>
                  <input name="amount" type="number" step="1000" min="1000" placeholder="Subscription Amount" style={styles.input} required/>
                  <button type="submit" style={styles.button}>Subscribe</button>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};


const BondIssuanceForm: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const party = useParty();
    const ledger = useLedger();
    const [formData, setFormData] = useState({
        isin: '',
        issueSize: '',
        couponRate: '',
        maturityDate: new Date(new Date().setFullYear(new Date().getFullYear() + 5)).toISOString().split('T')[0], // 5 years from now
        payingAgent: '',
        subscriptionEndDate: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString().split('T')[0], // 30 days from now
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await ledger.create(Issuance, {
                issuer: party,
                payingAgent: formData.payingAgent,
                isin: formData.isin,
                issueSize: parseFloat(formData.issueSize).toFixed(10),
                faceValue: "1000.0000000000",
                couponRate: (parseFloat(formData.couponRate) / 100).toFixed(10),
                maturityDate: formData.maturityDate,
                subscriptionWindow: {
                    start: new Date().toISOString(),
                    end: new Date(formData.subscriptionEndDate).toISOString(),
                },
                subscribedAmount: "0.0000000000",
                investors: [],
            });
            alert('Bond Issuance created successfully!');
            onClose();
        } catch (error) {
            console.error('Failed to create bond issuance:', error);
            alert(`Failed to create bond issuance: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    };

    return (
        <div style={styles.modalBackdrop}>
            <div style={styles.modalContent}>
                <h2>New Bond Issuance</h2>
                <form onSubmit={handleSubmit}>
                    <input name="isin" value={formData.isin} onChange={handleChange} placeholder="ISIN (e.g., US0378331005)" required style={styles.input} />
                    <input name="issueSize" type="number" value={formData.issueSize} onChange={handleChange} placeholder="Total Issue Size" required style={styles.input} />
                    <input name="couponRate" type="number" step="0.01" value={formData.couponRate} onChange={handleChange} placeholder="Coupon Rate (%)" required style={styles.input} />
                    <input name="maturityDate" type="date" value={formData.maturityDate} onChange={handleChange} placeholder="Maturity Date" required style={styles.input} />
                    <input name="payingAgent" value={formData.payingAgent} onChange={handleChange} placeholder="Paying Agent Party ID" required style={styles.input} />
                    <input name="subscriptionEndDate" type="date" value={formData.subscriptionEndDate} onChange={handleChange} placeholder="Subscription End Date" required style={styles.input} />
                    <div style={styles.formActions}>
                        <button type="submit" style={styles.button}>Create Issuance</button>
                        <button type="button" onClick={onClose} style={{...styles.button, ...styles.buttonSecondary}}>Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    );
};


// --- App Entry Point ---

const App: React.FC = () => {
  const [credentials, setCredentials] = useState<{ party: Party; token: string } | undefined>();

  // Determine the WebSocket URL from the current page's URL
  const wsUrl = useMemo(() => {
    const url = new URL(window.location.href);
    url.protocol = url.protocol.replace('http', 'ws');
    // The @c7/react ledger client connects to this streaming endpoint
    url.pathname = '/v2/stream/updates';
    return url.toString();
  }, []);

  if (!credentials) {
    return <LoginScreen onLogin={(party, token) => setCredentials({ party, token })} />;
  }

  return (
    <DamlLedger token={credentials.token} party={credentials.party} wsUrl={wsUrl}>
      <MainView />
    </DamlLedger>
  );
};


// --- Inline CSS Styles ---

const styles: { [key: string]: React.CSSProperties } = {
  loginContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#f0f2f5', fontFamily: 'sans-serif' },
  loginForm: { display: 'flex', flexDirection: 'column', gap: '1rem', padding: '2rem', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', minWidth: '300px' },
  mainContainer: { fontFamily: 'sans-serif', padding: '0 2rem', maxWidth: '1200px', margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 0', borderBottom: '1px solid #ccc', marginBottom: '1rem' },
  section: { marginBottom: '2rem' },
  table: { width: '100%', borderCollapse: 'collapse', },
  th: { borderBottom: '2px solid #ddd', padding: '12px', textAlign: 'left', backgroundColor: '#f9f9f9', fontWeight: 'bold' },
  td: { borderBottom: '1px solid #ddd', padding: '12px', textAlign: 'left' },
  issuanceList: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' },
  issuanceCard: { border: '1px solid #ccc', borderRadius: '8px', padding: '1rem', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  input: { padding: '0.75rem', borderRadius: '4px', border: '1px solid #ccc', width: '100%', boxSizing: 'border-box', marginBottom: '0.5rem' },
  button: { padding: '0.75rem 1.5rem', borderRadius: '4px', border: 'none', backgroundColor: '#007bff', color: 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' },
  buttonSecondary: { backgroundColor: '#6c757d'},
  modalBackdrop: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modalContent: { backgroundColor: 'white', padding: '2rem', borderRadius: '8px', width: '90%', maxWidth: '500px', boxShadow: '0 5px 15px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', gap: '1rem' },
  formActions: { display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }
};

export default App;