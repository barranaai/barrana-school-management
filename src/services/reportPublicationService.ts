export interface PublicationResponse {
  success: boolean;
  outcome: 'sent' | 'simulated' | 'delivery_failure' | 'pdf_failure' | 'persistence_failure' |
    'configuration_failure' | 'not_authorized' | 'not_finalized' | 'already_sent' | 'publication_blocked';
  message?: string;
  error?: string;
  data?: { reportId?: string; transportAccepted: boolean; simulated?: boolean; messageId?: string; sentAt?: string; pdfUrl?: string };
}

// Preserve the server outcome, especially transport acceptance followed by a save failure.
// Never retry delivery automatically or turn an HTTP 200 simulation into success.
export async function requestReportPublication(url: string, headers: HeadersInit, body: object): Promise<PublicationResponse> {
  try {
    const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    const result: PublicationResponse = await response.json();
    const success = response.ok && result.success === true && result.outcome === 'sent' && result.data?.transportAccepted === true;
    return { ...result, success, error: success ? undefined : result.message || 'Report publication failed' };
  } catch (_) {
    return { success: false, outcome: 'delivery_failure', error: 'Publication result is unknown. Check report state before retrying.' };
  }
}
