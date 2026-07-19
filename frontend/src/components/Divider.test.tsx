import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Divider } from './Divider';

describe('Divider', () => {
  it('renders the divider image', () => {
    // alt="" is intentional (decorative image), so it has no accessible
    // "img" role — query the DOM directly instead of screen.getByRole.
    const { container } = render(<Divider />);
    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', '/images/divider.png');
  });
});
