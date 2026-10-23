import { playOrderPlacedChime } from '../../src/services/feedbackSound';

describe('feedbackSound', () => {
  it('playOrderPlacedChime does not throw', async () => {
    expect(() => playOrderPlacedChime()).not.toThrow();
    // Allow the fire-and-forget async path to settle.
    await new Promise((r) => setTimeout(r, 30));
  });
});
