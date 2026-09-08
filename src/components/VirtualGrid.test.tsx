import { useVirtualizer } from '@tanstack/react-virtual';
import { render } from '@testing-library/react';

import VirtualGrid from './VirtualGrid';

jest.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: jest.fn(() => ({
    getVirtualItems: () => [],
    getTotalSize: () => 0,
    measureElement: jest.fn(),
    takeSnapshot: () => [],
    scrollOffset: 0,
  })),
  useWindowVirtualizer: jest.fn(),
}));

const mockedUseVirtualizer = useVirtualizer as jest.MockedFunction<
  typeof useVirtualizer
>;

describe('VirtualGrid', () => {
  it('virtualizes against document.body, the app page scroller', () => {
    render(
      <VirtualGrid
        items={['a', 'b', 'c']}
        renderItem={(item) => <div>{item}</div>}
      />,
    );

    expect(mockedUseVirtualizer).toHaveBeenCalled();
    const options = mockedUseVirtualizer.mock.calls[0][0];
    expect(options.getScrollElement?.()).toBe(document.body);
  });
});
