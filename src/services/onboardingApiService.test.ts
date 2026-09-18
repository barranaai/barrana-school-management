import { apiService } from './apiService';

const reply = (data: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: status < 400 ? 'OK' : 'Error',
  json: async () => ({ success: status < 400, data })
});

beforeEach(() => {
  (fetch as jest.Mock).mockReset();
  apiService.clearToken();
});

test('onboarding identity request uses the public onboarding endpoint and exact allowlisted payload', async () => {
  (fetch as jest.Mock).mockResolvedValue(reply(undefined, 202));
  await apiService.startOnboarding({ firstName: 'Avery', lastName: 'Owner', email: 'owner@example.invalid' });

  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining('/onboarding/start'),
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ firstName: 'Avery', lastName: 'Owner', email: 'owner@example.invalid' })
    })
  );
  expect((fetch as jest.Mock).mock.calls[0][1].headers).not.toHaveProperty('Authorization');
});

test('onboarding metadata uses the safe public metadata endpoint', async () => {
  (fetch as jest.Mock).mockResolvedValue(reply({ accountTypes: [], organizationTypes: [], schoolTypes: [] }));
  await apiService.getOnboardingMetadata();
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining('/onboarding/metadata'),
    expect.any(Object)
  );
  expect((fetch as jest.Mock).mock.calls[0][1].headers).not.toHaveProperty('Authorization');
});
test('package catalog uses the selected backend organization type without a hardcoded vertical', async () => {
  (fetch as jest.Mock).mockResolvedValue(reply([]));
  await apiService.listOnboardingPackages('arts_studio');
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining('/onboarding/packages?organizationType=arts_studio'),
    expect.any(Object)
  );
});

test('completion sends only the fields supplied by the onboarding form', async () => {
  (fetch as jest.Mock).mockResolvedValue(reply({ token: 'synthetic-auth-token', user: {}, standardPackageAdopted: false }, 201));
  await apiService.completeOnboarding({
    token: 'synthetic-verification-token',
    password: 'synthetic-password',
    accountType: 'solo_practitioner',
    workspaceName: 'Independent Practice'
  });

  const body = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);
  expect(body).toEqual({
    token: 'synthetic-verification-token',
    password: 'synthetic-password',
    accountType: 'solo_practitioner',
    workspaceName: 'Independent Practice'
  });
  expect(body).not.toHaveProperty('role');
  expect(body).not.toHaveProperty('schoolId');
  expect(body).not.toHaveProperty('ownerUserId');
});
