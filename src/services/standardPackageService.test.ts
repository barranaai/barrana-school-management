import {
  StandardPackageServiceError,
  standardPackageService
} from './standardPackageService';

const reply = (data: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => ({ success: status < 400, data })
});

beforeEach(() => {
  (fetch as jest.Mock).mockReset();
});

test('loads published packages and current organization adoptions', async () => {
  (fetch as jest.Mock)
    .mockResolvedValueOnce(reply([{ _id: 'package' }]))
    .mockResolvedValueOnce(reply([{ _id: 'adoption' }]));

  const api = standardPackageService('synthetic-token');
  await expect(api.listPublished()).resolves.toEqual([{ _id: 'package' }]);
  await expect(api.listAdoptions()).resolves.toEqual([{ _id: 'adoption' }]);

  expect(fetch).toHaveBeenNthCalledWith(
    1,
    expect.stringContaining('/standard-packages'),
    expect.objectContaining({
      method: 'GET',
      headers: expect.objectContaining({
        Authorization: 'Bearer synthetic-token'
      })
    })
  );
  expect(fetch).toHaveBeenNthCalledWith(
    2,
    expect.stringContaining('/standard-packages/adoptions'),
    expect.anything()
  );
});

test('adoption submits only an empty body and cannot inject an organization ID', async () => {
  (fetch as jest.Mock).mockResolvedValueOnce(reply({ _id: 'adoption' }));

  await standardPackageService('synthetic-token').adopt('package/id');

  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining('/standard-packages/package%2Fid/adopt'),
    expect.objectContaining({
      method: 'POST',
      body: '{}'
    })
  );
  expect(JSON.parse((fetch as jest.Mock).mock.calls[0][1].body)).toEqual({});
});

test('duplicate adoption has a safe typed result', async () => {
  (fetch as jest.Mock).mockResolvedValueOnce(
    reply({ message: 'PRIVATE_DATABASE_DETAIL' }, 409)
  );

  await expect(
    standardPackageService('synthetic-token').adopt('package')
  ).rejects.toMatchObject({
    name: 'StandardPackageServiceError',
    code: 'ALREADY_ADOPTED'
  });
});

test('authorization and unexpected failures do not expose backend details', async () => {
  (fetch as jest.Mock)
    .mockResolvedValueOnce(reply({ message: 'PRIVATE_AUTH_DETAIL' }, 403))
    .mockRejectedValueOnce(new Error('PRIVATE_NETWORK_DETAIL'));

  const api = standardPackageService('synthetic-token');

  await expect(api.listPublished()).rejects.toEqual(
    new StandardPackageServiceError('NOT_AUTHORIZED')
  );
  await expect(api.listPublished()).rejects.toEqual(
    new StandardPackageServiceError('REQUEST_FAILED')
  );
});
