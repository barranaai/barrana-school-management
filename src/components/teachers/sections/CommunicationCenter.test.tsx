import React from 'react';
import { act, Simulate } from 'react-dom/test-utils';
import { createRoot, Root } from 'react-dom/client';
import CommunicationCenter from './CommunicationCenter';
import messagingService from '../../../services/messagingService';

jest.mock('../../../services/messagingService', () => ({ __esModule: true, default: {
  getConversations: jest.fn(), getTeacherRecipients: jest.fn(), getConversationMessages: jest.fn(),
  markConversationAsRead: jest.fn(), sendMessageREST: jest.fn(), createConversation: jest.fn()
} }));

let host: HTMLDivElement, root: Root;
const settle = async () => act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
beforeEach(() => {
  (messagingService.getConversations as jest.Mock).mockResolvedValue({ success: true, data: [] });
  (messagingService.getTeacherRecipients as jest.Mock).mockResolvedValue({ success: true, data: [{ guardianId: 'g1', guardianName: 'Gina Guardian', participantId: 'c1', participantName: 'Casey Child' }] });
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); jest.clearAllMocks(); });

test('loads authorized recipients and shows the empty conversation state', async () => {
  root.render(<CommunicationCenter />); await settle();
  expect(document.body).toHaveTextContent('No conversations yet.');
  expect(document.body).not.toHaveTextContent('Coming Soon');
  expect(messagingService.getTeacherRecipients).toHaveBeenCalledTimes(1);
});

test('shows loading failures and allows a retry', async () => {
  (messagingService.getConversations as jest.Mock).mockRejectedValueOnce(new Error('Communication unavailable'));
  root.render(<CommunicationCenter />); await settle();
  expect(document.body).toHaveTextContent('Communication unavailable');
  const retry = Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Retry')!;
  await act(async () => { Simulate.click(retry); }); await settle();
  expect(messagingService.getConversations).toHaveBeenCalledTimes(2);
});

test('opens an existing conversation, reads messages, and sends successfully', async () => {
  const conversation = { _id: 'conv1', participants: [], subject: 'About Casey', unreadCount: 1, otherParticipant: { id: 'g1', name: 'Gina Guardian', role: 'parent' } };
  (messagingService.getConversations as jest.Mock).mockResolvedValue({ success: true, data: [conversation] });
  (messagingService.getConversationMessages as jest.Mock).mockResolvedValue({ success: true, data: [{ _id: 'm1', conversationId: 'conv1', senderId: 'g1', senderName: 'Gina Guardian', content: 'Hello', isRead: false, sentAt: new Date().toISOString() }], hasMore: false });
  (messagingService.markConversationAsRead as jest.Mock).mockResolvedValue({ success: true });
  (messagingService.sendMessageREST as jest.Mock).mockResolvedValue({ success: true, data: { _id: 'm2', content: 'Reply', senderName: 'Teacher' } });
  root.render(<CommunicationCenter />); await settle();
  const row = Array.from(document.querySelectorAll('[role="button"]')).find(item => item.textContent?.includes('Gina Guardian') && item.textContent?.includes('About Casey')) as HTMLElement;
  await act(async () => { Simulate.click(row); }); await settle();
  expect(document.body).toHaveTextContent('Hello');
  const input = document.querySelector('textarea')!;
  await act(async () => { Simulate.change(input, { target: { value: 'Reply' } }); });
  const send = document.querySelector('button[aria-label="Send message"]')!;
  await act(async () => { Simulate.click(send); }); await settle();
  expect(messagingService.sendMessageREST).toHaveBeenCalledWith('conv1', 'Reply');
});
