import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TagPicker } from './TagPicker';
import api from '@/lib/api';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    default: {
      ...actual.default,
      getTags: vi.fn(),
    },
  };
});

const mockGetTags = vi.mocked(api.getTags);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('TagPicker', () => {
  it('adds a new tag on Enter and calls onChange with the appended value', async () => {
    mockGetTags.mockResolvedValue([]);
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(<TagPicker value={[]} onChange={onChange} />);
    await user.type(screen.getByPlaceholderText('Add a tag...'), 'photography{Enter}');

    expect(onChange).toHaveBeenCalledWith(['photography']);
  });

  it('removes a tag when its × button is clicked', async () => {
    mockGetTags.mockResolvedValue([]);
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(<TagPicker value={['photography', 'travel']} onChange={onChange} />);
    await user.click(screen.getByLabelText('Remove photography'));

    expect(onChange).toHaveBeenCalledWith(['travel']);
  });

  it('does not add a duplicate tag (case-insensitive)', async () => {
    mockGetTags.mockResolvedValue([]);
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(<TagPicker value={['Photography']} onChange={onChange} />);
    await user.type(screen.getByPlaceholderText(''), 'photography{Enter}');

    expect(onChange).not.toHaveBeenCalled();
  });

  it('suggests existing tags matching the typed text, excluding ones already selected', async () => {
    mockGetTags.mockResolvedValue([
      { id: 't1', name: 'Photography', slug: 'photography', postCount: 3 },
      { id: 't2', name: 'Phytography', slug: 'phytography', postCount: 1 },
      { id: 't3', name: 'Travel', slug: 'travel', postCount: 2 },
    ]);
    const user = userEvent.setup();

    render(<TagPicker value={['Photography']} onChange={vi.fn()} />);
    await user.type(screen.getByPlaceholderText(''), 'phy');

    expect(await screen.findByText('Phytography')).toBeInTheDocument();
    // "Photography" still appears once, as the already-selected chip — just not as a second suggestion
    expect(screen.getAllByText('Photography')).toHaveLength(1);
    expect(screen.queryByText('Travel')).not.toBeInTheDocument();
  });

  it('adds a suggestion when clicked', async () => {
    mockGetTags.mockResolvedValue([{ id: 't1', name: 'Travel', slug: 'travel', postCount: 2 }]);
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(<TagPicker value={[]} onChange={onChange} />);
    await user.type(screen.getByPlaceholderText('Add a tag...'), 'trav');
    await user.click(await screen.findByText('Travel'));

    expect(onChange).toHaveBeenCalledWith(['Travel']);
  });
});
