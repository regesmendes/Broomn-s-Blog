'use client';

import { useEffect, useRef, useState } from 'react';
import api, { ApiError, Subscriber } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { RichTextEditor, RichTextEditorHandle } from '@/components/RichTextEditor';
import { ImagePickerModal } from '@/components/ImagePickerModal';

export default function AdminNewsletterPage() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [counts, setCounts] = useState({ total: 0, confirmed: 0, pending: 0, unsubscribed: 0 });
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const editorRef = useRef<RichTextEditorHandle>(null);
  const [emailSearch, setEmailSearch] = useState('');
  const [activeEmailSearch, setActiveEmailSearch] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const { getToken } = useAuth();

  useEffect(() => {
    loadSubscribers();
  }, [activeEmailSearch]);

  const loadSubscribers = async () => {
    setLoading(true);
    try {
      const result = await api.getSubscribers(getToken() || '', {
        email: activeEmailSearch || undefined,
      });
      setSubscribers(result.data);
      setCounts(result.counts);
    } catch {
      console.error('Failed to load subscribers');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveEmailSearch(emailSearch.trim());
  };

  const handleUnsubscribe = async (id: string) => {
    if (!confirm('Unsubscribe this address from the newsletter?')) return;
    setActionError(null);
    try {
      await api.adminUnsubscribeSubscriber(id, getToken() || '');
      await loadSubscribers();
    } catch {
      setActionError('Failed to unsubscribe.');
    }
  };

  const handleBlock = async (id: string) => {
    if (!confirm('Block this address? It will stop receiving newsletters and won\'t be able to re-subscribe.')) return;
    setActionError(null);
    try {
      await api.blockSubscriber(id, getToken() || '');
      await loadSubscribers();
    } catch {
      setActionError('Failed to block subscriber.');
    }
  };

  const handleUnblock = async (id: string) => {
    setActionError(null);
    try {
      await api.unblockSubscriber(id, getToken() || '');
      await loadSubscribers();
    } catch {
      setActionError('Failed to unblock subscriber.');
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

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">Newsletter</h1>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-center dark:border-gray-700 dark:bg-gray-800">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{counts.total}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Subscribers</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-center dark:border-gray-700 dark:bg-gray-800">
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{counts.confirmed}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Confirmed</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-center dark:border-gray-700 dark:bg-gray-800">
          <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{counts.pending}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Pending</p>
        </div>
      </div>

      {/* Send form */}
      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Send Newsletter</h2>
        <form onSubmit={handleSend} className="space-y-4">
          <div>
            <label htmlFor="subject" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Content
            </label>
            <div className="mt-1">
              <RichTextEditor
                ref={editorRef}
                content={content}
                onChange={setContent}
                placeholder="Write the newsletter content..."
                onImagePick={() => setImagePickerOpen(true)}
              />
              <ImagePickerModal
                isOpen={imagePickerOpen}
                onClose={() => setImagePickerOpen(false)}
                onSelect={(url) => {
                  editorRef.current?.insertImage(url);
                  setImagePickerOpen(false);
                }}
              />
            </div>
          </div>

          {sendSuccess && <p className="text-sm text-green-600 dark:text-green-400">{sendSuccess}</p>}
          {sendError && <p className="text-sm text-red-600 dark:text-red-400">{sendError}</p>}

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
      <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
            Subscribers
          </h2>
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              value={emailSearch}
              onChange={(e) => setEmailSearch(e.target.value)}
              placeholder="Search by email..."
              className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
            />
            <button
              type="submit"
              className="cursor-pointer rounded-md bg-emerald-700 px-4 py-1.5 text-sm text-white hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              Search
            </button>
            {activeEmailSearch && (
              <button
                type="button"
                onClick={() => {
                  setEmailSearch('');
                  setActiveEmailSearch('');
                }}
                className="cursor-pointer rounded-md border border-gray-300 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Clear
              </button>
            )}
          </form>
          {actionError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{actionError}</p>}
        </div>
        {loading ? (
          <p className="p-4 text-gray-500 dark:text-gray-400">Loading...</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Email</th>
                <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Status</th>
                <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Subscribed</th>
                <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {subscribers.map((sub) => (
                <tr key={sub.id}>
                  <td className="px-4 py-3 text-gray-900 dark:text-white">{sub.email}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          sub.status === 'CONFIRMED'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                            : sub.status === 'UNSUBSCRIBED'
                              ? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                              : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                        }`}
                      >
                        {sub.status === 'CONFIRMED'
                          ? 'Confirmed'
                          : sub.status === 'UNSUBSCRIBED'
                            ? 'Unsubscribed'
                            : 'Pending'}
                      </span>
                      {sub.blockedAt && (
                        <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900 dark:text-red-300">
                          Blocked
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {new Date(sub.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3 text-sm">
                      {sub.status !== 'UNSUBSCRIBED' && (
                        <button
                          onClick={() => handleUnsubscribe(sub.id)}
                          className="cursor-pointer text-yellow-600 hover:text-yellow-800 dark:text-yellow-400 dark:hover:text-yellow-300"
                        >
                          Unsubscribe
                        </button>
                      )}
                      {sub.blockedAt ? (
                        <button
                          onClick={() => handleUnblock(sub.id)}
                          className="cursor-pointer text-emerald-700 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-300"
                        >
                          Unblock
                        </button>
                      ) : (
                        <button
                          onClick={() => handleBlock(sub.id)}
                          className="cursor-pointer text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                        >
                          Block
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!loading && subscribers.length === 0 && (
          <p className="p-4 text-center text-gray-500 dark:text-gray-400">
            {activeEmailSearch ? 'No subscribers match your search.' : 'No subscribers yet.'}
          </p>
        )}
      </div>
    </div>
  );
}
