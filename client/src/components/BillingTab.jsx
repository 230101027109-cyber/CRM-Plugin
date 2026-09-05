import React, { useEffect, useState } from 'react';
import { Loader, CheckCircle2, AlertCircle } from 'lucide-react';
import { billingAPI } from '../services/api';

const BillingTab = () => {
  const [subscriptionData, setSubscriptionData] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [errorMsg, setErrorMsg] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [subRes, plansRes] = await Promise.all([
        billingAPI.getSubscription(),
        billingAPI.getPlans()
      ]);
      
      if (subRes.data.success) {
        setSubscriptionData(subRes.data.data);
      }
      if (plansRes.data.success) {
        setPlans(plansRes.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch billing data:', error);
      setErrorMsg('Failed to load billing information.');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async (planId) => {
    try {
      setActionLoading(true);
      const res = await billingAPI.createCheckout({ planId, billingCycle });
      if (res.data.success && res.data.url) {
        window.location.href = res.data.url;
      } else {
        setErrorMsg('Failed to initiate checkout.');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      setErrorMsg('Error creating checkout session.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleManageBilling = async () => {
    try {
      setActionLoading(true);
      const res = await billingAPI.createPortal();
      if (res.data.success && res.data.url) {
        window.location.href = res.data.url;
      } else {
        setErrorMsg('Failed to open billing portal.');
      }
    } catch (error) {
      console.error('Portal error:', error);
      setErrorMsg('Error opening billing portal.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader className="animate-spin text-green-600" size={32} />
      </div>
    );
  }

  const { status, plan, trialEnd, currentPeriodEnd } = subscriptionData || {};

  return (
    <div className="space-y-6">
      {errorMsg && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center gap-3">
          <AlertCircle size={20} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Current Subscription Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Current Plan</h2>
            <div className="mt-2 flex items-center gap-3">
              <span className="px-3 py-1 bg-green-100 text-green-700 font-semibold rounded-full text-sm">
                {plan?.name || 'Unknown Plan'}
              </span>
              <span className="text-gray-500 text-sm">
                Status: <strong className="capitalize">{status}</strong>
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-3">
              {status === 'trialing' && trialEnd && (
                <>Your free trial ends on {new Date(trialEnd).toLocaleDateString()}.</>
              )}
              {status === 'active' && currentPeriodEnd && (
                <>Your next billing date is {new Date(currentPeriodEnd).toLocaleDateString()}.</>
              )}
            </p>
          </div>
          {status === 'active' && (
            <button
              onClick={handleManageBilling}
              disabled={actionLoading}
              className="px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg font-medium transition"
            >
              Manage Billing
            </button>
          )}
        </div>
      </div>

      {/* Pricing Plans */}
      <div>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800">Upgrade Plan</h2>
          
          <div className="bg-gray-100 p-1 rounded-lg flex">
            <button
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${billingCycle === 'monthly' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
              onClick={() => setBillingCycle('monthly')}
            >
              Monthly
            </button>
            <button
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${billingCycle === 'yearly' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
              onClick={() => setBillingCycle('yearly')}
            >
              Yearly (Save 20%)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.filter(p => !p.isFree).map((p) => {
            const price = p.pricing[billingCycle];
            const isCurrent = plan?.planId === p.planId && status === 'active';
            const priceFormatted = price ? (price.amount / 100).toFixed(2) : '0.00';

            return (
              <div key={p.planId} className={`relative flex flex-col bg-white rounded-xl border ${p.badge ? 'border-green-500 shadow-md' : 'border-gray-200 shadow-sm'} p-6`}>
                {p.badge && (
                  <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                    {p.badge}
                  </div>
                )}
                
                <h3 className="text-lg font-bold text-gray-900">{p.name}</h3>
                <p className="text-sm text-gray-500 mt-2 h-10">{p.description}</p>
                
                <div className="my-6">
                  <span className="text-4xl font-extrabold text-gray-900">${priceFormatted}</span>
                  <span className="text-gray-500">/{billingCycle === 'monthly' ? 'mo' : 'yr'}</span>
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  <li className="flex items-center text-sm text-gray-600 gap-2">
                    <CheckCircle2 size={16} className="text-green-500" />
                    {p.features.maxUsers === -1 ? 'Unlimited' : p.features.maxUsers} Users
                  </li>
                  <li className="flex items-center text-sm text-gray-600 gap-2">
                    <CheckCircle2 size={16} className="text-green-500" />
                    {p.features.maxChannels === -1 ? 'Unlimited' : p.features.maxChannels} WhatsApp Channels
                  </li>
                  <li className="flex items-center text-sm text-gray-600 gap-2">
                    <CheckCircle2 size={16} className="text-green-500" />
                    {p.features.maxContacts === -1 ? 'Unlimited' : p.features.maxContacts.toLocaleString()} Contacts
                  </li>
                  {p.features.workflows && (
                    <li className="flex items-center text-sm text-gray-600 gap-2">
                      <CheckCircle2 size={16} className="text-green-500" /> Automation Workflows
                    </li>
                  )}
                  {p.features.analytics && (
                    <li className="flex items-center text-sm text-gray-600 gap-2">
                      <CheckCircle2 size={16} className="text-green-500" /> Advanced Analytics
                    </li>
                  )}
                  {p.features.apiAccess && (
                    <li className="flex items-center text-sm text-gray-600 gap-2">
                      <CheckCircle2 size={16} className="text-green-500" /> API Access
                    </li>
                  )}
                </ul>

                <button
                  onClick={() => handleCheckout(p.planId)}
                  disabled={isCurrent || actionLoading}
                  className={`w-full py-2.5 rounded-lg font-medium transition ${
                    isCurrent
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : p.badge
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-green-50 text-green-700 hover:bg-green-100'
                  }`}
                >
                  {isCurrent ? 'Current Plan' : actionLoading ? 'Processing...' : 'Upgrade'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default BillingTab;
