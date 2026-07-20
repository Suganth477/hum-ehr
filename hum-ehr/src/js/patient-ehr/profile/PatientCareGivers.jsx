import { useCallback, useEffect, useState } from 'react';
import moment from '../../../utils/dayjs';
import { Dialog } from 'primereact/dialog';
import {
    getPatientDetails, fetchCareGiversList, fetchCareGiverTypes, saveCareGiver, deleteCareGiver,
    validateZipCode, formatPhoneInput,
} from '../../../services/patientProfileService';
import US_STATES from '../../../constants/usStates';
import FlatpickrDateTimeInput from '../../../components/common/FlatpickrDateTimeInput';
import { SkeletonTable } from '../../../components/common/ContentLoader';
import { LegacyIcon } from '../../../components/common/CustomIcons';
import { useNotify } from '../../../context/NotificationContext';

const FieldError = ({ message }) => (message ? <div className="small text-danger mt-1">{message}</div> : null);
const PHONE_RE = /^\(\d{3}\)-\d{3}-\d{4}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ONLY_ALPHA = /^[a-zA-Z]+( [a-zA-Z]+)*$/;

const initialsFromName = (name = '') => name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
const formatAddress = (record) => [record.addressLine1, record.addressLine2, record.addressCity, record.addressState, record.addressZipCode]
    .filter((part) => String(part || '').trim()).join(', ');

/**
 * Care Givers tab (legacy patient-care-givers): Active / In-active lists with
 * card rows, add/edit modal (type-dependent relationship / description /
 * consent fields, zip autofill, effective date & time window), delete via
 * /caregivers/invalid.
 */
const PatientCareGivers = ({ patientId }) => {
    const { notifySuccess, notifyError } = useNotify();
    const [recordType, setRecordType] = useState('active');
    const [records, setRecords] = useState(null);
    const [types, setTypes] = useState(null); // { typeList, relationshipList }
    const [dialog, setDialog] = useState(null);
    const [form, setForm] = useState(null);
    const [errors, setErrors] = useState({});
    const [zipInvalid, setZipInvalid] = useState(false);
    const [saving, setSaving] = useState(false);
    const [dob, setDob] = useState('');

    const load = useCallback(async (type) => {
        setRecords(null);
        try { setRecords(await fetchCareGiversList(type, patientId)); }
        catch (error) { console.error(error); notifyError('Failed to fetch patient care givers details. Please try again.'); }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [patientId]);
    useEffect(() => { load(recordType); }, [load, recordType]);
    useEffect(() => {
        getPatientDetails(patientId).then((details) => setDob(details?.dateOfBirth || '')).catch(() => {});
    }, [patientId]);

    const today = moment().format('MM-DD-YYYY');

    const openDialog = async (record = null) => {
        try {
            let typeData = types;
            if (!typeData) {
                typeData = await fetchCareGiverTypes();
                setTypes(typeData);
            }
            setForm({
                careGiverId: record?.careGiverId || '',
                typeCode: record?.typeCode || '',
                typeDescription: record?.otherDescription || '',
                relationship: record?.relationshipCode || '',
                consentFlag: record?.consentFlag === 'Y',
                firstName: record?.firstName || '',
                middleName: record?.middleName || '',
                lastName: record?.lastName || '',
                phoneNumber: record?.phoneNumber || '',
                email: record?.email || '',
                addressId: record?.addressId || '',
                addressLine1: record?.addressLine1 || '',
                addressLine2: record?.addressLine2 || '',
                addressCity: record?.addressCity || '',
                addressState: (record?.addressState || '').toUpperCase(),
                addressZipCode: record?.addressZipCode || '',
                effectiveDate: record?.effectiveDate || `${today} 12:00 AM`,
                lastEffectiveDate: record?.lastEffectiveDate || '',
                alertFlag: record?.alertFlag === 'Y',
            });
            setErrors({});
            setZipInvalid(false);
            setDialog({ record });
        }
        catch (error) { console.error(error); notifyError('Failed to get patient care giver type'); }
    };

    const update = (patch) => setForm((prev) => ({ ...prev, ...patch }));
    const clearError = (key) => setErrors((prev) => { if (!prev[key]) return prev; const next = { ...prev }; delete next[key]; return next; });

    const handleTypeChange = (typeCode) => {
        // FAMLY → relationship + consent; CGOTH → description; FRIE → consent only.
        update({ typeCode, typeDescription: '', relationship: '', consentFlag: false });
        clearError('typeCode');
    };

    const handleZipChange = async (zip) => {
        update({ addressZipCode: zip });
        clearError('addressZipCode');
        setZipInvalid(false);
        if (!/^\d{5}$/.test(zip)) return;
        try {
            const list = await validateZipCode(zip);
            if (list === null) { notifyError('Failed to validate zip code. Please try again.'); return; }
            if (list.length) update({ addressZipCode: zip, addressCity: list[0].city, addressState: list[0].state });
            else setZipInvalid(true);
        }
        catch (error) { console.error(error); }
    };

    const recordedDay = (form?.effectiveDate || '').split(' ')[0];
    const endDateEnabled = recordedDay && recordedDay !== today;

    const validate = () => {
        const next = {};
        if (!form.effectiveDate) next.effectiveDate = 'Effective date is required.';
        if (!form.firstName) next.firstName = 'First Name is required.';
        else if (form.firstName.length > 25) next.firstName = 'Maximum 25 characters.';
        else if (!ONLY_ALPHA.test(form.firstName)) next.firstName = 'Only alphabets and single space are allowed.';
        if (form.middleName && !ONLY_ALPHA.test(form.middleName)) next.middleName = 'Only alphabets and single space are allowed.';
        if (!form.lastName) next.lastName = 'Last Name is required.';
        else if (form.lastName.length > 25) next.lastName = 'Maximum 25 characters.';
        else if (!ONLY_ALPHA.test(form.lastName)) next.lastName = 'Only alphabets and single space are allowed.';
        if (!form.phoneNumber) next.phoneNumber = 'Mobile Number is required.';
        else if (!PHONE_RE.test(form.phoneNumber)) next.phoneNumber = 'Phone Number is invalid.';
        if (form.email && (form.email.length < 6 || form.email.length > 50 || !EMAIL_RE.test(form.email))) next.email = 'Email Address is Invalid.';
        const lineOne = form.addressLine1.trim();
        const anyOther = form.addressLine2.trim() || form.addressState.trim() || form.addressCity.trim() || form.addressZipCode.trim();
        if (!lineOne && anyOther) next.addressLine1 = 'Address Line One is required.';
        else if (lineOne && lineOne.length < 3) next.addressLine1 = 'Minimum 3 characters.';
        else if (lineOne.length > 100) next.addressLine1 = 'Maximum 100 characters.';
        if (form.addressLine2.length > 100) next.addressLine2 = 'Maximum 100 characters.';
        if (lineOne) {
            if (!form.addressCity.trim()) next.addressCity = 'City is required.';
            else if (form.addressCity.trim().length < 3) next.addressCity = 'Minimum 3 characters.';
            else if (form.addressCity.trim().length > 25) next.addressCity = 'Maximum 25 characters.';
            if (!form.addressState.trim()) next.addressState = 'State is required.';
            if (!form.addressZipCode.trim()) next.addressZipCode = 'Zip Code is required.';
            else if (!/^\d{5}$/.test(form.addressZipCode.trim())) next.addressZipCode = form.addressZipCode.trim().length !== 5 ? 'The length of zip code must be 5 digits' : 'Zip code is invalid.';
        }
        if (!form.typeCode) next.typeCode = 'Type is required.';
        if (form.typeCode === 'CGOTH') {
            if (!form.typeDescription) next.typeDescription = 'Type is required.';
            else if (form.typeDescription.length < 2) next.typeDescription = 'Minimum 2 characters.';
            else if (form.typeDescription.length > 75) next.typeDescription = 'Maximum 75 characters.';
        }
        if (form.typeCode === 'FAMLY' && !form.relationship) next.relationship = 'Relationship is required.';
        return next;
    };

    const handleSave = async () => {
        const validation = validate();
        setErrors(validation);
        if (Object.keys(validation).length) return;
        setSaving(true);
        try {
            // Legacy activeFlag: 'N' when the last effective date & time is already past.
            let activeFlagStatus = 'Y';
            if (form.lastEffectiveDate && moment(form.lastEffectiveDate, 'MM-DD-YYYY hh:mm A').isBefore(moment())) activeFlagStatus = 'N';
            const response = await saveCareGiver({
                patientId,
                careGiverId: form.careGiverId || '',
                activeFlag: activeFlagStatus,
                recordType: 'active',
                effectiveDate: form.effectiveDate,
                lastEffectiveDate: form.lastEffectiveDate || '',
                firstName: form.firstName || '',
                middleName: form.middleName || '',
                lastName: form.lastName || '',
                phoneNumber: form.phoneNumber || '',
                email: form.email || '',
                addressId: form.addressId || '',
                addressLine1: form.addressLine1 || '',
                addressLine2: form.addressLine2 || '',
                addressCity: form.addressCity || '',
                addressState: form.addressState || '',
                addressCountry: 'USA',
                addressZipCode: form.addressZipCode || '',
                typeCode: form.typeCode || '',
                typeDescription: form.typeDescription || '',
                relationship: form.relationship || '',
                consentFlag: form.consentFlag ? 'Y' : 'N',
                alertFlag: form.alertFlag ? 'Y' : 'N',
            });
            if (response?.status === 'success') {
                notifySuccess(form.careGiverId ? 'patient care givers updated successfully.' : 'Patient care givers saved successfully.');
                setDialog(null);
                load(recordType);
            }
            else if (response?.status === 'warning') {
                setErrors((prev) => ({ ...prev, firstName: 'Care giver already added for the selected date range.' }));
            }
            else notifyError('Failed to save Patient care givers. Please try again.');
        }
        catch (error) { console.error(error); notifyError('Failed to save Patient care givers. Please try again.'); }
        finally { setSaving(false); }
    };

    const handleDelete = async (record) => {
        if (!window.confirm('Are you sure about deleting the Caregiver record?')) return;
        try {
            const response = await deleteCareGiver({ patientId, careGiverId: record.careGiverId, recordType, lastEffectiveDate: record.lastEffectiveDate });
            if (response?.status === 'success') {
                notifySuccess('Caregiver record deleted successfully.');
                load(recordType);
            }
            else notifyError('Failed to delete patient care givers details.');
        }
        catch (error) { console.error(error); notifyError('Failed to delete patient care givers details.'); }
    };

    const showDescription = form?.typeCode === 'CGOTH';
    const showRelationship = form?.typeCode === 'FAMLY';
    const showConsent = form?.typeCode === 'FAMLY' || form?.typeCode === 'FRIE';

    return (<div>
      <div className="fw-bold mx-3 my-3" style={{ color: 'var(--app-color2, #189FAA)', fontSize: 16 }}>Caregivers</div>
      <div className="d-flex justify-content-between align-items-center mx-3 my-2 flex-wrap gap-2">
        <ul className="nav nav-pills pp-soft-nav-pill mb-0">
          <li className="nav-item active-history-toggle-list">
            <button type="button" className={`nav-link active-history-nav-link small ${recordType === 'active' ? 'active' : ''}`} onClick={() => setRecordType('active')}>Active</button>
          </li>
          <li className="nav-item active-history-toggle-list">
            <button type="button" className={`nav-link active-history-nav-link small ${recordType === 'history' ? 'active' : ''}`} onClick={() => setRecordType('history')}>In-active</button>
          </li>
        </ul>
        <button type="button" className="btn btn-primary btn-md border-radius-button" onClick={() => openDialog(null)}>
          <LegacyIcon icon="mdi-plus"/> Add Caregiver
        </button>
      </div>

      <div className="pp-care-givers-list-body mx-3 my-3">
        {records === null && <SkeletonTable columns={['S.No', 'Care Status Type', 'Recorded Date', 'Start Date', 'End Date', 'Care Notes', '']} rows={4}/>}
        {records !== null && records.length === 0 && (
          <div className="text-center py-4">
            <LegacyIcon icon="mdi-information-outline" style={{ fontSize: 30, verticalAlign: 'sub' }}/>
            <span style={{ fontSize: 20 }}> Patient doesn&apos;t have any {recordType === 'active' ? 'active caregivers' : 'inactive caregivers'} yet! </span>
          </div>
        )}
        {(records || []).map((record) => (
          <div className="pp-care-giver-row d-flex gap-3 mt-2 p-2" key={record.careGiverId}>
            <div className="pp-member-avatar text-uppercase">{initialsFromName(record.fullName)}</div>
            <div className="flex-grow-1" style={{ minWidth: 0 }}>
              <div className="d-flex justify-content-between align-items-start">
                <span className="text-capitalize fw-bold mt-1">{record.fullName || ''}</span>
                <div className="d-flex gap-3">
                  {recordType === 'active' && (
                    <span className="pp-record-action-icon edit" title="Edit" role="button" onClick={() => openDialog(record)}><LegacyIcon icon="fa-pen"/></span>
                  )}
                  <span className="pp-record-action-icon delete" title="Delete" role="button" onClick={() => handleDelete(record)}><LegacyIcon icon="fa-trash"/></span>
                </div>
              </div>
              <div className="row mt-2 gy-1">
                <div className="col-md-3"><LegacyIcon icon="fa-phone" className="me-1"/><span className="fw-semibold">{record.phoneNumber || '-'}</span></div>
                <div className="col-md-4"><LegacyIcon icon="fa-envelope" className="me-1"/><span className="fw-semibold">{record.email || '-'}</span></div>
                <div className="col-md-5"><LegacyIcon icon="fa-house" className="me-1"/><span className="fw-semibold">{formatAddress(record) || '-'}</span></div>
              </div>
              <div className="row mt-2 gy-1">
                <div className="col-md-3"><LegacyIcon icon="mdi-calendar-month-outline" className="me-1"/>Effective Date &amp; Time : <span className="fw-semibold">{record.effectiveDate || '-'}</span></div>
                <div className="col-md-4"><LegacyIcon icon="mdi-calendar-month-outline" className="me-1"/>Last Effective Date &amp; Time : <span className="fw-semibold">{record.lastEffectiveDate || '-'}</span></div>
                <div className="col-md-5">Alert Communication : <span className="fw-semibold">{record.alertFlag === 'Y' ? 'Yes' : 'No'}</span></div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog visible={!!dialog} onHide={() => setDialog(null)} header={dialog?.record ? 'Edit Caregiver' : 'Add Care Status'} style={{ width: '75vw' }} breakpoints={{ '992px': '98vw' }}>
        {form && (<form autoComplete="off" onSubmit={(e) => { e.preventDefault(); handleSave(); }} noValidate>
          <div className="row g-3">
            <div className="col-md-4">
              <label>First Name <span className="text-danger">*</span></label>
              <input type="text" className="form-control" value={form.firstName} onChange={(e) => { update({ firstName: e.target.value }); clearError('firstName'); }}/>
              <FieldError message={errors.firstName}/>
            </div>
            <div className="col-md-4">
              <label>Mobile Number <span className="text-danger">*</span></label>
              <input type="text" className="form-control" value={form.phoneNumber} onChange={(e) => { update({ phoneNumber: formatPhoneInput(e.target.value) }); clearError('phoneNumber'); }}/>
              <FieldError message={errors.phoneNumber}/>
            </div>
            <div className="col-md-4">
              <label>City <span className="text-danger">*</span></label>
              <input type="text" className="form-control" value={form.addressCity} onChange={(e) => { update({ addressCity: e.target.value }); clearError('addressCity'); }}/>
              <FieldError message={errors.addressCity}/>
            </div>
            <div className="col-md-4">
              <label>Middle Name</label>
              <input type="text" className="form-control" value={form.middleName} onChange={(e) => { update({ middleName: e.target.value }); clearError('middleName'); }}/>
              <FieldError message={errors.middleName}/>
            </div>
            <div className="col-md-4">
              <label>Email</label>
              <input type="text" className="form-control" value={form.email} onChange={(e) => { update({ email: e.target.value }); clearError('email'); }}/>
              <FieldError message={errors.email}/>
            </div>
            <div className="col-md-4">
              <label>State</label>
              <select className="form-select" value={form.addressState} onChange={(e) => { update({ addressState: e.target.value }); clearError('addressState'); }}>
                <option value="">State</option>
                {US_STATES.map((state) => <option key={state} value={state}>{state}</option>)}
              </select>
              <FieldError message={errors.addressState}/>
            </div>
            <div className="col-md-4">
              <label>Last Name <span className="text-danger">*</span></label>
              <input type="text" className="form-control" value={form.lastName} onChange={(e) => { update({ lastName: e.target.value }); clearError('lastName'); }}/>
              <FieldError message={errors.lastName}/>
            </div>
            <div className="col-md-4">
              <label>Address Line One</label>
              <input type="text" className="form-control" value={form.addressLine1} onChange={(e) => { update({ addressLine1: e.target.value }); clearError('addressLine1'); }}/>
              <FieldError message={errors.addressLine1}/>
            </div>
            <div className="col-md-4">
              <label>Zip Code</label>
              <input type="text" className="form-control" maxLength={5} value={form.addressZipCode} onChange={(e) => handleZipChange(e.target.value.replace(/\D/g, ''))}/>
              {zipInvalid && <div className="small text-danger mt-1"><LegacyIcon icon="fa-exclamation-triangle" className="me-1"/><b>Invalid Zip Code</b></div>}
              <FieldError message={errors.addressZipCode}/>
            </div>
            <div className="col-md-4">
              <label>Type <span className="text-danger">*</span></label>
              <select className="form-select" value={form.typeCode} onChange={(e) => handleTypeChange(e.target.value)}>
                <option value="">Select Type</option>
                {(types?.typeList || []).map((type) => <option key={type.code} value={type.code}>{type.description}</option>)}
              </select>
              <FieldError message={errors.typeCode}/>
            </div>
            {showDescription && (<div className="col-md-4">
              <label>Description</label>
              <input type="text" className="form-control text-capitalize" placeholder="Type" value={form.typeDescription} onChange={(e) => { update({ typeDescription: e.target.value }); clearError('typeDescription'); }}/>
              <FieldError message={errors.typeDescription}/>
            </div>)}
            {showRelationship && (<div className="col-md-4">
              <label>Relationship <span className="text-danger">*</span></label>
              <select className="form-select" value={form.relationship} onChange={(e) => { update({ relationship: e.target.value }); clearError('relationship'); }}>
                <option value="">Select Relationship</option>
                {(types?.relationshipList || []).map((rel) => <option key={rel.code} value={rel.code}>{rel.description}</option>)}
              </select>
              <FieldError message={errors.relationship}/>
            </div>)}
            {showConsent && (<div className="col-md-4">
              <label>Caregiver Consent</label>
              <div><input type="checkbox" style={{ width: 20, height: 20 }} checked={form.consentFlag} onChange={(e) => update({ consentFlag: e.target.checked })}/></div>
            </div>)}
            <div className="col-md-4">
              <label>Address Line Two</label>
              <input type="text" className="form-control" value={form.addressLine2} onChange={(e) => { update({ addressLine2: e.target.value }); clearError('addressLine2'); }}/>
              <FieldError message={errors.addressLine2}/>
            </div>
            <div className="col-md-4">
              <label>Effective Date &amp; Time <span className="text-danger">*</span></label>
              <FlatpickrDateTimeInput value={form.effectiveDate} enableTime dateFormat="m-d-Y h:i K" placeholder="MM-DD-YYYY HH:MM AM/PM"
                minDate={dob ? `${dob} 12:00 AM` : undefined} maxDate={`${today} 11:59 PM`}
                onChange={(val) => { update({ effectiveDate: val, lastEffectiveDate: '' }); clearError('effectiveDate'); }}/>
              <FieldError message={errors.effectiveDate}/>
            </div>
            <div className="col-md-4">
              <label>Last Effective Date &amp; Time</label>
              <FlatpickrDateTimeInput value={form.lastEffectiveDate} enableTime dateFormat="m-d-Y h:i K" placeholder="MM-DD-YYYY HH:MM AM/PM"
                disabled={!endDateEnabled} minDate={form.effectiveDate || undefined} maxDate={`${today} 11:59 PM`}
                onChange={(val) => update({ lastEffectiveDate: val })}/>
            </div>
            {form.email && EMAIL_RE.test(form.email) && (<div className="col-md-4">
              <label>Alert Communication</label>
              <div><input type="checkbox" style={{ width: 20, height: 20 }} checked={form.alertFlag} onChange={(e) => update({ alertFlag: e.target.checked })}/></div>
            </div>)}
          </div>
          <div className="d-flex justify-content-between mt-3">
            <button type="button" className="btn btn-primary rounded-pill px-4" disabled={saving}
              onClick={() => { if (window.confirm('Are you sure about cancel care giver form?')) setDialog(null); }}>Cancel</button>
            <button type="submit" className="btn btn-primary rounded-pill px-4" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>)}
      </Dialog>
    </div>);
};
export default PatientCareGivers;
