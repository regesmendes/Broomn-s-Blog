'use client';

import { useEffect, useState } from 'react';
import api, { ApiError, Subscriber } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export default function AdminNewsletterPage() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');

  const { getToken } = useAuth();

  useEffect(() => {
    loadSubscribers();
  }, []);

  const loadSubscribers = async () => {
    try {
      const data = await api.getSubscribers(getToken() || '');
      setSubscribers(data);
    } catch {
      console.error('Failed to load subscribers');
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setSendSuccess(null);
    setSendError(null);

    try {
      const result = await api.sendNewsletter({ subject, content }, getToken() || '');
      setSendSuccess(`Newsletter sent to ${result.sent} subscribers.`);
      setSubject('');
      setContent('');
    } catch (err) {
      if (err instanceof ApiError) {
        setSendError(err.message);
      } else {
        setSendError('Failed to send newsletter.');
      }
    } finally {
      setSending(false);
    }
  };

  const confirmedCount = subscribers.filter((s) => s.confirmed).length;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Newsletter</h1>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{subscribers.length}</p>
          <p className="text-sm text-gray-500">Total Subscribers</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{confirmedCount}</p>
          <p className="text-sm text-gray-500">Confirmed</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
          <p className="text-2xl font-bold text-yellow-600">
            {subscribers.length - confirmedCount}
          </p>
          <p className="text-sm text-gray-500">Pending</p>
        </div>
      </div>

      {/* Send form */}
      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Send Newsletter</h2>
        <form onSubmit={handleSend} className="space-y-4">
          <div>
            <label htmlFor="subject" className="block text-sm font-medium text-gray-700">
              Subject
            </label>
            <input
              id="subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
            />
          </div>
          <div>
            <label htmlFor="nl-content" className="block text-sm font-medium text-gray-700">
              Content
            </label>
            <textarea
              id="nl-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              rows={6}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
            />
          </div>

          {sendSuccess && <p className="text-sm text-green-600">{sendSuccess}</p>}
          {sendError && <p className="text-sm text-red-600">{sendError}</p>}

          <button
            type="submit"
            disabled={sending}
            className="rounded-md bg-gray-900 px-6 py-2 text-white hover:bg-gray-700 disabled:opacity-50"
          >
            {sending ? 'Sending...' : 'Send Newsletter'}
          </button>
        </form>
      </div>

      {/* Subscribers table */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <h2 className="border-b border-gray-200 px-4 py-3 text-lg font-semibold text-gray-900">
          Subscribers
        </h2>
        {loading ? (
          <p className="p-4 text-gray-500">Loading...</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-700">Email</th>
                <th className="px-4 py-3 font-medium text-gray-700">Status</th>
                <th className="px-4 py-3 font-medium text-gray-700">Subscribed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {subscribers.map((sub) => (
                <tr key={sub.id}>
                  <td className="px-4 py-3 text-gray-900">{sub.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        sub.confirmed
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {sub.confirmed ? 'Confirmed' : 'Pending'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(sub.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!loading && subscribers.length === 0 && (
          <p className="p-4 text-center text-gray-500">No subscribers yet.</p>
        )}
      </div>
    </div>
  );
}
