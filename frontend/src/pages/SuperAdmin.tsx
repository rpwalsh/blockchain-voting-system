import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import './SuperAdmin.css';

interface Organization {
  id: string;
  name: string;
  slug: string;
  type: string;
  status: string;
  tier: string;
  email: string;
  createdAt: string;
  _count: {
    elections: number;
    users: number;
  };
}

interface Election {
  id: string;
  name: string;
  description: string;
  type: string;
  status: string;
  startDate: string;
  endDate: string;
  organizationId: string;
  organization?: {
    name: string;
  };
  _count: {
    candidates: number;
    voters: number;
    votes: number;
  };
}

interface User {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  organizationId: string;
  organization?: {
    name: string;
  };
  createdAt: string;
}

export default function SuperAdmin() {
  const [activeTab, setActiveTab] = useState<'organizations' | 'elections' | 'users' | 'create-org' | 'create-election'>('organizations');
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [elections, setElections] = useState<Election[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  // Create Organization Form
  const [newOrg, setNewOrg] = useState({
    name: '',
    slug: '',
    type: 'MUNICIPAL',
    tier: 'ENTERPRISE',
    email: '',
    primaryContact: '',
    phone: '',
    website: ''
  });

  // Create Election Form
  const [newElection, setNewElection] = useState({
    organizationId: '',
    name: '',
    description: '',
    type: 'SINGLE_CHOICE',
    startDate: '',
    endDate: '',
    allowAnonymous: true,
    requireId: true
  });

  // Candidates for new election
  const [candidates, setCandidates] = useState<Array<{name: string; party: string; description: string}>>([
    { name: '', party: '', description: '' }
  ]);

  useEffect(() => {
    const user = localStorage.getItem('user');
    if (!user) {
      navigate('/login');
      return;
    }
    
    const userData = JSON.parse(user);
    if (userData.role !== 'SUPER_ADMIN') {
      navigate('/elections');
      return;
    }

    loadData();
  }, [navigate]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('authToken');
      const config = { headers: { Authorization: `Bearer ${token}` } };

      const [orgsRes, electionsRes, usersRes] = await Promise.all([
        api.get('/superadmin/organizations', config),
        api.get('/superadmin/elections', config),
        api.get('/superadmin/users', config)
      ]);

      setOrganizations(orgsRes.data.organizations || []);
      setElections(electionsRes.data.elections || []);
      setUsers(usersRes.data.users || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('authToken');
      await api.post('/superadmin/organizations', newOrg, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSuccess(`Organization "${newOrg.name}" created successfully!`);
      setNewOrg({
        name: '',
        slug: '',
        type: 'MUNICIPAL',
        tier: 'ENTERPRISE',
        email: '',
        primaryContact: '',
        phone: '',
        website: ''
      });
      
      await loadData();
      setActiveTab('organizations');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create organization');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateElection = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('authToken');
      
      // Filter out empty candidates
      const validCandidates = candidates.filter(c => c.name.trim() !== '');
      
      if (validCandidates.length === 0) {
        setError('Please add at least one candidate');
        setLoading(false);
        return;
      }

      await api.post('/superadmin/elections', {
        ...newElection,
        candidates: validCandidates
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSuccess(`Election "${newElection.name}" created successfully!`);
      setNewElection({
        organizationId: '',
        name: '',
        description: '',
        type: 'SINGLE_CHOICE',
        startDate: '',
        endDate: '',
        allowAnonymous: true,
        requireId: true
      });
      setCandidates([{ name: '', party: '', description: '' }]);
      
      await loadData();
      setActiveTab('elections');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create election');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteOrganization = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete organization "${name}"? This will delete ALL elections, users, and data.`)) {
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      await api.delete(`/superadmin/organizations/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccess(`Organization "${name}" deleted`);
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete organization');
    }
  };

  const handleDeleteElection = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete election "${name}"?`)) {
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      await api.delete(`/superadmin/elections/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccess(`Election "${name}" deleted`);
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete election');
    }
  };

  const addCandidate = () => {
    setCandidates([...candidates, { name: '', party: '', description: '' }]);
  };

  const removeCandidate = (index: number) => {
    setCandidates(candidates.filter((_, i) => i !== index));
  };

  const updateCandidate = (index: number, field: string, value: string) => {
    const updated = [...candidates];
    updated[index] = { ...updated[index], [field]: value };
    setCandidates(updated);
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="super-admin">
      <div className="admin-header">
        <h1>🔐 Super Admin Dashboard</h1>
        <div className="admin-actions">
          <button onClick={handleLogout} className="btn btn-secondary">Logout</button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="admin-tabs">
        <button 
          className={activeTab === 'organizations' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('organizations')}
        >
          Organizations ({organizations.length})
        </button>
        <button 
          className={activeTab === 'elections' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('elections')}
        >
          Elections ({elections.length})
        </button>
        <button 
          className={activeTab === 'users' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('users')}
        >
          Users ({users.length})
        </button>
        <button 
          className={activeTab === 'create-org' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('create-org')}
        >
          + Create Organization
        </button>
        <button 
          className={activeTab === 'create-election' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('create-election')}
        >
          + Create Election
        </button>
      </div>

      <div className="admin-content">
        {loading && <div className="loading">Loading...</div>}

        {activeTab === 'organizations' && (
          <div className="organizations-list">
            <h2>Organizations</h2>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Tier</th>
                  <th>Status</th>
                  <th>Elections</th>
                  <th>Users</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {organizations.map(org => (
                  <tr key={org.id}>
                    <td><strong>{org.name}</strong><br/><small>{org.slug}</small></td>
                    <td>{org.type}</td>
                    <td><span className={`badge badge-${org.tier.toLowerCase()}`}>{org.tier}</span></td>
                    <td><span className={`status status-${org.status.toLowerCase()}`}>{org.status}</span></td>
                    <td>{org._count.elections}</td>
                    <td>{org._count.users}</td>
                    <td>{new Date(org.createdAt).toLocaleDateString()}</td>
                    <td>
                      <button 
                        onClick={() => handleDeleteOrganization(org.id, org.name)}
                        className="btn btn-danger btn-sm"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'elections' && (
          <div className="elections-list">
            <h2>All Elections</h2>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Organization</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Candidates</th>
                  <th>Voters</th>
                  <th>Votes</th>
                  <th>Dates</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {elections.map(election => (
                  <tr key={election.id}>
                    <td><strong>{election.name}</strong></td>
                    <td>{election.organization?.name}</td>
                    <td>{election.type}</td>
                    <td><span className={`status status-${election.status.toLowerCase()}`}>{election.status}</span></td>
                    <td>{election._count.candidates}</td>
                    <td>{election._count.voters}</td>
                    <td>{election._count.votes}</td>
                    <td>
                      {new Date(election.startDate).toLocaleDateString()} - {new Date(election.endDate).toLocaleDateString()}
                    </td>
                    <td>
                      <button 
                        onClick={() => handleDeleteElection(election.id, election.name)}
                        className="btn btn-danger btn-sm"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="users-list">
            <h2>All Users</h2>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Username</th>
                  <th>Organization</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id}>
                    <td>{user.firstName} {user.lastName}</td>
                    <td>{user.email}</td>
                    <td>{user.username}</td>
                    <td>{user.organization?.name}</td>
                    <td><span className={`badge badge-${user.role.toLowerCase()}`}>{user.role}</span></td>
                    <td>
                      <span className={user.isActive ? 'status status-active' : 'status status-inactive'}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'create-org' && (
          <div className="create-org">
            <h2>Create New Organization</h2>
            <form onSubmit={handleCreateOrganization} className="admin-form">
              <div className="form-grid">
                <div className="form-group">
                  <label>Organization Name *</label>
                  <input
                    type="text"
                    value={newOrg.name}
                    onChange={(e) => setNewOrg({...newOrg, name: e.target.value})}
                    placeholder="e.g., City of Springfield"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Slug (URL-safe identifier) *</label>
                  <input
                    type="text"
                    value={newOrg.slug}
                    onChange={(e) => setNewOrg({...newOrg, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-')})}
                    placeholder="e.g., springfield-city"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Type *</label>
                  <select 
                    value={newOrg.type}
                    onChange={(e) => setNewOrg({...newOrg, type: e.target.value})}
                  >
                    <option value="FEDERAL">Federal Government</option>
                    <option value="STATE">State Government</option>
                    <option value="MUNICIPAL">Municipal Government</option>
                    <option value="CORPORATE">Corporate</option>
                    <option value="PROJECT">Project/DAO</option>
                    <option value="BOARD">Board of Directors</option>
                    <option value="NGO">NGO/Non-Profit</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Tier *</label>
                  <select 
                    value={newOrg.tier}
                    onChange={(e) => setNewOrg({...newOrg, tier: e.target.value})}
                  >
                    <option value="FREE">Free (1,000 voters)</option>
                    <option value="STARTER">Starter (10,000 voters)</option>
                    <option value="ENTERPRISE">Enterprise (100,000 voters)</option>
                    <option value="UNLIMITED">Unlimited</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Email *</label>
                  <input
                    type="email"
                    value={newOrg.email}
                    onChange={(e) => setNewOrg({...newOrg, email: e.target.value})}
                    placeholder="contact@springfield.gov"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Primary Contact *</label>
                  <input
                    type="text"
                    value={newOrg.primaryContact}
                    onChange={(e) => setNewOrg({...newOrg, primaryContact: e.target.value})}
                    placeholder="John Smith"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Phone</label>
                  <input
                    type="tel"
                    value={newOrg.phone}
                    onChange={(e) => setNewOrg({...newOrg, phone: e.target.value})}
                    placeholder="+1 (555) 123-4567"
                  />
                </div>

                <div className="form-group">
                  <label>Website</label>
                  <input
                    type="url"
                    value={newOrg.website}
                    onChange={(e) => setNewOrg({...newOrg, website: e.target.value})}
                    placeholder="https://springfield.gov"
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
                {loading ? 'Creating...' : 'Create Organization'}
              </button>
            </form>
          </div>
        )}

        {activeTab === 'create-election' && (
          <div className="create-election">
            <h2>Create New Election</h2>
            <form onSubmit={handleCreateElection} className="admin-form">
              <div className="form-grid">
                <div className="form-group full-width">
                  <label>Organization *</label>
                  <select 
                    value={newElection.organizationId}
                    onChange={(e) => setNewElection({...newElection, organizationId: e.target.value})}
                    required
                  >
                    <option value="">Select an organization</option>
                    {organizations.map(org => (
                      <option key={org.id} value={org.id}>{org.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group full-width">
                  <label>Election Name *</label>
                  <input
                    type="text"
                    value={newElection.name}
                    onChange={(e) => setNewElection({...newElection, name: e.target.value})}
                    placeholder="e.g., 2026 Mayoral Election"
                    required
                  />
                </div>

                <div className="form-group full-width">
                  <label>Description</label>
                  <textarea
                    value={newElection.description}
                    onChange={(e) => setNewElection({...newElection, description: e.target.value})}
                    placeholder="Election description..."
                    rows={3}
                  />
                </div>

                <div className="form-group">
                  <label>Election Type *</label>
                  <select 
                    value={newElection.type}
                    onChange={(e) => setNewElection({...newElection, type: e.target.value})}
                  >
                    <option value="SINGLE_CHOICE">Single Choice</option>
                    <option value="MULTIPLE_CHOICE">Multiple Choice</option>
                    <option value="RANKED_CHOICE">Ranked Choice</option>
                    <option value="APPROVAL">Approval Voting</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Start Date *</label>
                  <input
                    type="datetime-local"
                    value={newElection.startDate}
                    onChange={(e) => setNewElection({...newElection, startDate: e.target.value})}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>End Date *</label>
                  <input
                    type="datetime-local"
                    value={newElection.endDate}
                    onChange={(e) => setNewElection({...newElection, endDate: e.target.value})}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={newElection.allowAnonymous}
                      onChange={(e) => setNewElection({...newElection, allowAnonymous: e.target.checked})}
                    />
                    Allow Anonymous Voting
                  </label>
                </div>

                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={newElection.requireId}
                      onChange={(e) => setNewElection({...newElection, requireId: e.target.checked})}
                    />
                    Require ID Verification
                  </label>
                </div>
              </div>

              <div className="candidates-section">
                <h3>Candidates</h3>
                {candidates.map((candidate, index) => (
                  <div key={index} className="candidate-row">
                    <input
                      type="text"
                      placeholder="Candidate Name *"
                      value={candidate.name}
                      onChange={(e) => updateCandidate(index, 'name', e.target.value)}
                      required
                    />
                    <input
                      type="text"
                      placeholder="Party/Affiliation"
                      value={candidate.party}
                      onChange={(e) => updateCandidate(index, 'party', e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="Description"
                      value={candidate.description}
                      onChange={(e) => updateCandidate(index, 'description', e.target.value)}
                    />
                    {candidates.length > 1 && (
                      <button 
                        type="button" 
                        onClick={() => removeCandidate(index)}
                        className="btn btn-danger btn-sm"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={addCandidate} className="btn btn-secondary">
                  + Add Candidate
                </button>
              </div>

              <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
                {loading ? 'Creating...' : 'Create Election'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
