import { useCallback, useEffect, useState } from 'react';
import moment from '../../../utils/dayjs';
import { getPatientDetails, refreshPatientDetails, savePreferredDayTime, convert24To12 } from '../../../services/patientProfileService';
import { SkeletonTable } from '../../../components/common/ContentLoader';
import { LegacyIcon } from '../../../components/common/CustomIcons';
import { useNotify } from '../../../context/NotificationContext';

const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const TIME_RE = /^(0[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/i;

const emptyRows = () => DAY_KEYS.reduce((acc, key) => ({ ...acc, [key]: { checked: false, from: '', to: '' } }), {});

/**
 * Preferred Day & Time (legacy view-patient-pref-date-time /
 * update-patient-pref-date-time): weekly table with a day-range shortcut and
 * common from/to propagation to checked days. Save posts the legacy
 * mon..sun start/end payload to /patient/update/preferreddaytime.
 */
const PatientPreferredDayTime = ({ patientId }) => {
    const { notifySuccess, notifyError } = useNotify();
    const [details, setDetails] = useState(null);
    const [editing, setEditing] = useState(false);
    const [rows, setRows] = useState(emptyRows);
    const [dayRange, setDayRange] = useState('selection');
    const [common, setCommon] = useState({ from: '', to: '' });
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        try { setDetails(await getPatientDetails(patientId)); }
        catch (error) { console.error(error); }
    }, [patientId]);
    useEffect(() => { load(); }, [load]);

    const openEdit = () => {
        const next = emptyRows();
        (details.preferredDayTimes || []).forEach((entry) => {
            const key = entry.day?.toLowerCase();
            if (next[key]) next[key] = { checked: true, from: convert24To12(entry.startTime), to: convert24To12(entry.endTime) };
        });
        setRows(next);
        setErrors({});
        // Auto-populate day range + common times from the loaded rows.
        syncCommonFields(next);
        setEditing(true);
    };

    const syncCommonFields = (nextRows) => {
        const checked = DAY_KEYS.filter((key) => nextRows[key].checked);
        const froms = checked.map((key) => nextRows[key].from).filter(Boolean);
        const tos = checked.map((key) => nextRows[key].to).filter(Boolean);
        const allSame = checked.length > 0 && froms.length === checked.length && tos.length === checked.length
            && froms.every((value) => value === froms[0]) && tos.every((value) => value === tos[0]);
        setCommon(allSame ? { from: froms[0], to: tos[0] } : { from: '', to: '' });
        if (checked.length === 7) setDayRange('all');
        else if (checked.length === 5 && DAY_KEYS.slice(0, 5).every((key) => nextRows[key].checked)) setDayRange('week_days');
        else setDayRange('selection');
    };

    const updateRow = (key, patch) => {
        setRows((prev) => {
            const next = { ...prev, [key]: { ...prev[key], ...patch } };
            syncCommonFields(next);
            return next;
        });
        setErrors((prev) => { const next = { ...prev }; delete next[key]; return next; });
    };

    const handleDayToggle = (key, checked) => {
        updateRow(key, checked ? { checked } : { checked, from: '', to: '' });
    };

    const handleDayRange = (value) => {
        setDayRange(value);
        setRows((prev) => {
            const next = { ...prev };
            if (value === 'week_days') {
                DAY_KEYS.slice(0, 5).forEach((key) => { next[key] = { ...next[key], checked: true }; });
                DAY_KEYS.slice(5).forEach((key) => { next[key] = { checked: false, from: '', to: '' }; });
            }
            else if (value === 'all') {
                DAY_KEYS.forEach((key) => { next[key] = { ...next[key], checked: true }; });
            }
            else {
                DAY_KEYS.forEach((key) => { next[key] = { checked: false, from: '', to: '' }; });
            }
            return next;
        });
    };

    // Common from/to propagate to every checked row (legacy behavior keeps the
    // values only when the resulting range stays valid).
    const handleCommonChange = (field, rawValue) => {
        const value = rawValue.toUpperCase();
        const nextCommon = { ...common, [field]: value };
        setCommon(nextCommon);
        if (!value || !TIME_RE.test(value)) return;
        const fromMoment = nextCommon.from && TIME_RE.test(nextCommon.from) ? moment(nextCommon.from, 'hh:mm A') : null;
        const toMoment = nextCommon.to && TIME_RE.test(nextCommon.to) ? moment(nextCommon.to, 'hh:mm A') : null;
        if (fromMoment && toMoment && toMoment.diff(fromMoment) < 0) return;
        setRows((prev) => {
            const next = { ...prev };
            DAY_KEYS.forEach((key) => {
                if (next[key].checked) next[key] = { ...next[key], [field === 'from' ? 'from' : 'to']: value };
            });
            return next;
        });
    };

    const validate = () => {
        const next = {};
        DAY_KEYS.forEach((key) => {
            const row = rows[key];
            if (!row.checked) return;
            if (!row.from || !row.to) { next[key] = 'Time is required.'; return; }
            if (!TIME_RE.test(row.from) || !TIME_RE.test(row.to)) { next[key] = 'Time should be in hh:mm AM/PM format.'; return; }
            if (moment(row.to, 'hh:mm A').diff(moment(row.from, 'hh:mm A')) <= 0) next[key] = 'To Time should be greater than From Time.';
        });
        return next;
    };

    const handleSave = async () => {
        const validation = validate();
        setErrors(validation);
        if (Object.keys(validation).length) return;
        setSaving(true);
        try {
            const payload = {
                id: patientId,
                personId: details.personId,
                monStartTime: rows.monday.from || '', monEndTime: rows.monday.to || '',
                tueStartTime: rows.tuesday.from || '', tueEndTime: rows.tuesday.to || '',
                wedStartTime: rows.wednesday.from || '', wedEndTime: rows.wednesday.to || '',
                thuStartTime: rows.thursday.from || '', thuEndTime: rows.thursday.to || '',
                friStartTime: rows.friday.from || '', friEndTime: rows.friday.to || '',
                satStartTime: rows.saturday.from || '', satEndTime: rows.saturday.to || '',
                sunStartTime: rows.sunday.from || '', sunEndTime: rows.sunday.to || '',
            };
            const response = await savePreferredDayTime(payload);
            if (response?.status === 'success') {
                notifySuccess('Preferred Date and Time updated successfully');
                await refreshPatientDetails(patientId);
                await load();
                setEditing(false);
            }
            else notifyError('Failed to update patient preferred day and time. Please try again.');
        }
        catch (error) { console.error(error); notifyError('Failed to update patient preferred day and time. Please try again.'); }
        finally { setSaving(false); }
    };

    if (!details) return <div className="mx-md-3 my-1" style={{ maxWidth: 640 }}><SkeletonTable columns={['Days', 'From Time', 'To Time']} rows={7}/></div>;

    if (!editing) {
        return (<div className="mx-md-3 my-1">
          <div className="d-flex justify-content-between">
            <div className="table-responsive">
              <table className="table pp-pref-table">
                <thead><tr><th style={{ width: 200 }}>Days</th><th style={{ width: 120 }}>From Time</th><th style={{ width: 120 }}>To Time</th></tr></thead>
                <tbody>
                  {WEEK_DAYS.map((day) => {
                    const entry = (details.preferredDayTimes || []).find((item) => item.day === day);
                    return (<tr key={day} className={entry ? '' : 'disabled'}>
                      <td>{day}</td>
                      <td><input className="form-control" readOnly value={entry ? convert24To12(entry.startTime) : '00:00 AM'}/></td>
                      <td><input className="form-control" readOnly value={entry ? convert24To12(entry.endTime) : '00:00 PM'}/></td>
                    </tr>);
                  })}
                </tbody>
              </table>
            </div>
            <span role="button" title="Edit Preferred Day and Time" onClick={openEdit}><LegacyIcon icon="mdi-pencil" style={{ fontSize: 18 }}/></span>
          </div>
        </div>);
    }

    return (<form autoComplete="off" onSubmit={(e) => { e.preventDefault(); handleSave(); }} noValidate>
      <div className="d-flex justify-content-center">
        <div className="table-responsive">
          <table className="table pp-pref-table">
            <thead><tr><th colSpan={2}>Days</th><th>From Time</th><th>To Time</th></tr></thead>
            <tbody>
              <tr>
                <td colSpan={2}>
                  <select className="form-select" value={dayRange} onChange={(e) => handleDayRange(e.target.value)}>
                    <option value="selection">Selection</option>
                    <option value="week_days">Week Days</option>
                    <option value="all">All</option>
                  </select>
                </td>
                <td><input type="text" className="form-control" placeholder="00:00 AM" value={common.from} onChange={(e) => handleCommonChange('from', e.target.value)}/></td>
                <td><input type="text" className="form-control" placeholder="00:00 PM" value={common.to} onChange={(e) => handleCommonChange('to', e.target.value)}/></td>
              </tr>
              {WEEK_DAYS.map((day, index) => {
                const key = DAY_KEYS[index];
                const row = rows[key];
                return (<tr key={key}>
                  <td style={{ width: 30 }}><input type="checkbox" checked={row.checked} onChange={(e) => handleDayToggle(key, e.target.checked)}/></td>
                  <td style={{ width: 200 }}>{day}</td>
                  <td>
                    <input type="text" className="form-control" placeholder="00:00 AM" disabled={!row.checked} value={row.from}
                      onChange={(e) => updateRow(key, { from: e.target.value.toUpperCase() })}/>
                  </td>
                  <td>
                    <input type="text" className="form-control" placeholder="00:00 PM" disabled={!row.checked} value={row.to}
                      onChange={(e) => updateRow(key, { to: e.target.value.toUpperCase() })}/>
                    {errors[key] && <div className="small text-danger mt-1">{errors[key]}</div>}
                  </td>
                </tr>);
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="d-flex justify-content-end gap-2 mt-2 mb-2 me-2">
        <button type="button" className="btn btn-primary rounded-pill px-4" disabled={saving}
          onClick={() => { if (window.confirm('Are you sure about cancel preferred day & time?')) setEditing(false); }}>Cancel</button>
        <button type="submit" className="btn btn-primary rounded-pill px-4" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
      </div>
    </form>);
};
export default PatientPreferredDayTime;
