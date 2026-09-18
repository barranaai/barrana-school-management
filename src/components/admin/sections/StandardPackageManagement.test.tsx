import React from 'react';
import { act, Simulate } from 'react-dom/test-utils';
import { createRoot, Root } from 'react-dom/client';
import StandardPackageManagement from './StandardPackageManagement';
import { useAuth } from '../../../contexts/AuthContext';

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: jest.fn()
}));

const swimming = {
  _id: 'swimming-v1',
  slug: 'swimming',
  name: 'Swimming',
  description: 'Beginner swimming configuration',
  version: 1,
  status: 'published',
  organizationTypes: ['sports_club']
};

const adoption = {
  _id: 'adoption',
  schoolId: 'school',
  packageId: {
    _id: 'swimming-v1',
    name: 'Swimming',
    slug: 'swimming',
    version: 1,
    status: 'published'
  },
  packageSlug: 'swimming',
  packageVersion: 1,
  adoptedAt: '2026-09-18T00:00:00.000Z',
  status: 'completed'
};

const reply = (data: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => ({ success: status < 400, data })
});

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  (useAuth as jest.Mock).mockReturnValue({
    user: {
      _id: 'admin',
      role: 'school_admin',
      schoolId: 'school'
    },
    token: 'synthetic-token'
  });
  (fetch as jest.Mock).mockReset();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const step = async (action: () => void) => {
  await act(async () => {
    action();
  });
};

const renderPackages = async (
  packages = [swimming],
  adoptions: unknown[] = []
) => {
  (fetch as jest.Mock)
    .mockResolvedValueOnce(reply(packages))
    .mockResolvedValueOnce(reply(adoptions));
  await step(() => root.render(<StandardPackageManagement />));
};

function button(text: string) {
  return Array.from(document.querySelectorAll('button')).find(
    element => element.textContent === text
  ) as HTMLButtonElement;
}

test('displays published package details and an Adopt action', async () => {
  await renderPackages();

  expect(document.body).toHaveTextContent('Standard Packages');
  expect(document.body).toHaveTextContent('Swimming');
  expect(document.body).toHaveTextContent('Beginner swimming configuration');
  expect(document.body).toHaveTextContent('Version 1');
  expect(document.body).toHaveTextContent('Organization type: Sports Club');
  expect(button('Adopt Standard')).toBeEnabled();
});

test('an adopted package displays its organization-owned state', async () => {
  await renderPackages([swimming], [adoption]);

  expect(document.body).toHaveTextContent(
    'This organization has its own editable copy.'
  );
  expect(button('Adopted')).toBeDisabled();
});

test('successful adoption uses the existing API and refreshes the state', async () => {
  await renderPackages();

  await step(() => Simulate.click(button('Adopt Standard')));
  expect(document.body).toHaveTextContent('Adopt Standard Package');

  (fetch as jest.Mock)
    .mockResolvedValueOnce(reply(adoption, 201))
    .mockResolvedValueOnce(reply([swimming]))
    .mockResolvedValueOnce(reply([adoption]));

  await step(() => Simulate.click(button('Confirm adoption')));

  expect(fetch).toHaveBeenNthCalledWith(
    3,
    expect.stringContaining('/standard-packages/swimming-v1/adopt'),
    expect.objectContaining({
      method: 'POST',
      body: '{}'
    })
  );
  expect(document.body).toHaveTextContent(
    'This organization now has its own editable copy.'
  );
  expect(button('Adopted')).toBeDisabled();
  expect(JSON.parse((fetch as jest.Mock).mock.calls[2][1].body)).toEqual({});
});

test('duplicate adoption is handled safely and refreshes adopted state', async () => {
  await renderPackages();
  await step(() => Simulate.click(button('Adopt Standard')));

  (fetch as jest.Mock)
    .mockResolvedValueOnce(
      reply({ message: 'PRIVATE_DUPLICATE_INDEX_DETAIL' }, 409)
    )
    .mockResolvedValueOnce(reply([swimming]))
    .mockResolvedValueOnce(reply([adoption]));

  await step(() => Simulate.click(button('Confirm adoption')));

  expect(document.body).toHaveTextContent(
    'This package version has already been adopted'
  );
  expect(document.body).not.toHaveTextContent(
    'PRIVATE_DUPLICATE_INDEX_DETAIL'
  );
  expect(button('Adopted')).toBeDisabled();
});

test('authorization and API failures show safe messages', async () => {
  (fetch as jest.Mock)
    .mockResolvedValueOnce(reply({ message: 'PRIVATE_AUTH_DETAIL' }, 403))
    .mockResolvedValueOnce(reply([]));

  await step(() => root.render(<StandardPackageManagement />));

  expect(document.body).toHaveTextContent(
    'Unable to load or adopt Standard Packages'
  );
  expect(document.body).not.toHaveTextContent('PRIVATE_AUTH_DETAIL');
});

test.each(['teacher', 'parent', 'super_admin'])(
  '%s cannot use the organization adoption UI',
  async role => {
    (useAuth as jest.Mock).mockReturnValue({
      user: { _id: role, role, schoolId: role === 'super_admin' ? undefined : 'school' },
      token: 'synthetic-token'
    });

    await step(() => root.render(<StandardPackageManagement />));

    expect(document.body).toHaveTextContent(
      'Organization Administrator access required.'
    );
    expect(fetch).not.toHaveBeenCalled();
  }
);
