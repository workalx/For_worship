import { render } from '@testing-library/react';
import { PhotoImport } from './PhotoImport';

test('можна вибрати фото з галереї, а не лише зняти камерою', () => {
  const { container } = render(<PhotoImport onResult={() => {}} onError={() => {}} />);
  const input = container.querySelector('input[type=file]')!;
  expect(input).toHaveAttribute('accept', 'image/*');
  expect(input).not.toHaveAttribute('capture');
});
