import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import RewardCard from '../RewardCard';

describe('RewardCard', () => {
  const mockReward = {
    id: 'test-reward-1',
    title_en: 'Test Reward',
    description_en: 'Test Description',
    coins_cost: 100,
    xp_reward: 10,
    is_redeemed: false,
  };

  const mockOnRedeem = () => {};

  it('renders without crashing', () => {
    render(<RewardCard reward={mockReward} onRedeem={mockOnRedeem} />);
    expect(screen.getByText('Test Reward')).toBeInTheDocument();
  });

  it('handles null/undefined reward gracefully', () => {
    const { container } = render(<RewardCard reward={null as any} onRedeem={mockOnRedeem} />);
    expect(container.firstChild).toBeNull();
  });

  it('handles reward without id gracefully', () => {
    const invalidReward = { ...mockReward, id: '' };
    const { container } = render(<RewardCard reward={invalidReward} onRedeem={mockOnRedeem} />);
    expect(container.firstChild).toBeNull();
  });

  it('displays reward information correctly', () => {
    render(<RewardCard reward={mockReward} onRedeem={mockOnRedeem} userCoins={200} />);
    expect(screen.getByText('Test Reward')).toBeInTheDocument();
    expect(screen.getByText('Test Description')).toBeInTheDocument();
    expect(screen.getByText(/Cost: 100 coins/)).toBeInTheDocument();
  });

  it('shows redeemed state when reward is redeemed', () => {
    const redeemedReward = { ...mockReward, is_redeemed: true, coupon_code: 'TEST123' };
    render(<RewardCard reward={redeemedReward} onRedeem={mockOnRedeem} />);
    expect(screen.getByText('Purchased')).toBeInTheDocument();
    expect(screen.getByText('TEST123')).toBeInTheDocument();
  });

  it('disables redeem button when user cannot afford', () => {
    render(<RewardCard reward={mockReward} onRedeem={mockOnRedeem} userCoins={50} />);
    const button = screen.getByText('Redeem');
    expect(button).toBeDisabled();
  });

  it('enables redeem button when user can afford', () => {
    render(<RewardCard reward={mockReward} onRedeem={mockOnRedeem} userCoins={200} />);
    const button = screen.getByText('Redeem');
    expect(button).not.toBeDisabled();
  });

  it('handles conditional rendering correctly', () => {
    const { rerender } = render(<RewardCard reward={mockReward} onRedeem={mockOnRedeem} />);
    expect(screen.queryByText('Purchased')).not.toBeInTheDocument();

    const redeemedReward = { ...mockReward, is_redeemed: true };
    rerender(<RewardCard reward={redeemedReward} onRedeem={mockOnRedeem} />);
    expect(screen.getByText('Purchased')).toBeInTheDocument();
  });
});

