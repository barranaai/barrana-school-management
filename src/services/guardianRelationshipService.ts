import apiService from './apiService';

const BASE = process.env.REACT_APP_API_URL || '/api';
export type GuardianPermissions = { canViewProfile:boolean; canViewReports:boolean; canReceiveCommunications:boolean; canManageMeetings:boolean; canViewIncidents:boolean };
export type GuardianRelationship = {
  _id:string; guardian:{_id:string;firstName:string;lastName:string;email:string;isActive:boolean}; participantId:string;
  relationshipType:'parent'|'legal_guardian'|'caregiver'|'other'; isPrimaryContact:boolean; status:'pending'|'active'|'revoked'; permissions:GuardianPermissions;
};
const request = async (path:string, options:RequestInit={}) => {
  const token=apiService.getToken();
  const response=await fetch(BASE+path,{...options,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{ }),...(options.headers||{})}});
  const body=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(body.message || 'Guardian relationship request failed.');
  return body;
};
const query=(schoolId?:string)=>schoolId?`?schoolId=${encodeURIComponent(schoolId)}`:'';
export const guardianRelationshipService={
  list:async(participantId:string,schoolId?:string)=>request(`/guardian-relationships/participant/${encodeURIComponent(participantId)}${query(schoolId)}`),
  search:async(term:string,schoolId?:string)=>request(`/guardian-relationships/guardians/search?q=${encodeURIComponent(term)}${schoolId?`&schoolId=${encodeURIComponent(schoolId)}`:''}`),
  createGuardian:async(data:{firstName:string;lastName:string;email:string;phone?:string;schoolId?:string})=>(await request('/guardian-relationships/guardians',{method:'POST',body:JSON.stringify(data)})).data,
  link:async(data:Record<string,unknown>)=>(await request('/guardian-relationships',{method:'POST',body:JSON.stringify(data)})).data,
  update:async(id:string,data:Record<string,unknown>,schoolId?:string)=>(await request(`/guardian-relationships/${id}${query(schoolId)}`,{method:'PATCH',body:JSON.stringify(data)})).data,
  activate:async(id:string,schoolId?:string)=>(await request(`/guardian-relationships/${id}/activate${query(schoolId)}`,{method:'POST'})).data,
  revoke:async(id:string,reason:string,schoolId?:string)=>(await request(`/guardian-relationships/${id}/revoke${query(schoolId)}`,{method:'POST',body:JSON.stringify({reason})})).data
};
