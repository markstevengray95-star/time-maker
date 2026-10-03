import {KEY} from './timetableCore.js';
export function saveSchool(data) {
 localStorage.setItem(KEY,JSON.stringify(data));
 window.dispatchEvent(new CustomEvent('time-maker-school-saved',{detail:data}));
}
