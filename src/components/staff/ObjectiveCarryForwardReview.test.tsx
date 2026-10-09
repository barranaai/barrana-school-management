import React from 'react';
import { act, Simulate } from 'react-dom/test-utils';
import { createRoot, Root } from 'react-dom/client';
import ObjectiveCarryForwardReview from './ObjectiveCarryForwardReview';
import { objectiveCarryForwardService } from '../../services/objectiveCarryForwardService';
jest.mock('../../services/objectiveCarryForwardService', () => ({ ...jest.requireActual('../../services/objectiveCarryForwardService'), objectiveCarryForwardService: jest.fn() }));
const suggestion = { objectiveId: 'objective', status: 'not_achieved', title: 'Safe entry', expectedOutcome: 'Enter safely', source: { progressId: 'progress', deliveredSessionId: 'session', plannedSessionId: 'plan' }, targets: [{ _id: 'target', title: 'Next lesson', sequence: 2 }] };
let root: Root, host: HTMLDivElement, api: any;
beforeEach(() => { api = { suggestions: jest.fn().mockResolvedValue([suggestion]), accept: jest.fn().mockResolvedValue({}) }; (objectiveCarryForwardService as jest.Mock).mockReturnValue(api); host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });
const step = async (fn: () => void) => { await act(async () => { fn(); }); };
const button = (name: string) => Array.from(document.querySelectorAll('button')).find(item => item.textContent === name)!;
async function render() { await step(() => root.render(<ObjectiveCarryForwardReview token="token" schoolId="school" progressId="progress" />)); }
async function chooseTarget() { const label = Array.from(document.querySelectorAll('label')).find(item => item.textContent?.startsWith('Future session'))!; await step(() => Simulate.mouseDown(document.getElementById(label.htmlFor)!, { button: 0 })); const option = Array.from(document.querySelectorAll('[role="option"]')).find(item => item.textContent?.includes('Next lesson'))!; await step(() => Simulate.click(option)); }
test('instructor reviews, edits and accepts an eligible objective', async () => { await render(); expect(document.body).toHaveTextContent('not achieved'); expect(button('Carry forward')).toBeDisabled(); const title = document.querySelector('input[value="Safe entry"]')!; await step(() => Simulate.change(title, { target: { value: 'Edited safe entry' } })); await chooseTarget(); await step(() => Simulate.click(button('Carry forward'))); expect(api.accept).toHaveBeenCalledWith('progress', 'objective', 'target', expect.objectContaining({ title: 'Edited safe entry', expectedOutcome: 'Enter safely' })); expect(document.body).toHaveTextContent('Objective added'); });
test('rejecting a suggestion dismisses it without an API write', async () => { await render(); await step(() => Simulate.click(button('Reject suggestion'))); expect(api.accept).not.toHaveBeenCalled(); expect(document.body).not.toHaveTextContent('Safe entry'); });
