import { useCallback, useEffect, useState } from 'react';
import moment from '../../../utils/dayjs';
import AsyncSelect from 'react-select/async';
import { Dialog } from 'primereact/dialog';
import {
    getPatientDetails, fetchSpecialtyProvidersList, fetchTaxonomyLookup, fetchCommunicationMethods,
    validateSpecialtyProviderUnique, saveSpecialtyProvider, deleteSpecialtyProvider, formatPhoneInput,
} from '../../../services/patientProfileService';
import FlatpickrDateTimeInput from '../../../components/common/FlatpickrDateTimeInput';
import { SkeletonTable } from '../../../components/common/ContentLoader';
import { LegacyIcon } from '../../../components/common/CustomIcons';
import { LOOKUP_MIN_CHARS } from '../../../constants/timing';
import { useNotify } from '../../../context/NotificationContext';
import { ROLE_DESC_PROVIDER } from './PatientCareTeam';

const FieldError = ({ message }) => (message ? <div className="small text-danger mt-1">{message}</div> : null);
const PHONE_RE = /^\(\d{3}\)-\d{3}-\d{4}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ONLY_ALPHA = /^[a-zA-Z]+( [a-zA-Z]+)*$/;

/**
 * Specialty Providers accordion (legacy patient-specialty-providers):
 * Active / In-active lists, add/edit modal with taxonomy specialty lookup and
 * a server-side duplicate check, delete via /speciality/physicians/invalid.
 */
const PatientSpecialtyProviders = ({ patientId }) => {
    const { notifySuccess, notifyError } = useNotify();
    const [open, setOpen] = useState(true);
    const [recordType, setRecordType] = useState('active');
    const [records, setRecords] = useState(null);
    const [dialog, setDialog] = useState(null); // { record | null }
    const [commMethods, setCommMethods] = useState([]);
    const [form, setForm] = useState(null);
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [dob, setDob] = useState('');

    const load = useCallback(async (type) => {
        setRecords(null);
        try { setRecords(await fetchSpecialtyProvidersList(type, patientId)); }
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
            if (!commMethods.length) {
                // Legacy removes home + other phone comm options for this form.
                const methods = await fetchCommunicationMethods();
                setCommMethods(methods.filter((method) => method.code !== 'CHPH' && method.code !== 'COPH'));
            }
            setForm({
                healthCareProviderId: record?.healthCareProviderId || '',
                npi: record?.npi || '',
                specialtyId: record?.specialtyId || '',
                specialtyLabel: record?.specialityCode || '',
                firstName: record?.firstName || '',
                middleName: record?.middleName || '',
                lastName: record?.lastName || '',
                primaryCommunication: record?.primaryCommunicationCode || '',
                effectiveDate: record?.effectiveDate || `${today} 12:00 AM`,
                lastEffectiveDate: record?.lastEffectiveDate || '',
                email: record?.email || '',
                mobilePhone: record?.mobilePhone || '',
                pagerPhone: record?.homePhone || '',
                workPhone: record?.workPhone || '',
                alertFlag: record?.alertFlag === 'Y',
            });
            setErrors({});
            setDialog({ record });
        }
        catch (error) { console.error(error); notifyError('Failed to fetch communication type'); }
    };

    const update = (patch) => setForm((prev) => ({ ...prev, ...patch }));
    const clearError = (key) => setErrors((prev) => { if (!prev[key]) return prev; const next = { ...prev }; delete next[key]; return next; });

    const loadSpecialty = (input) => ((input || '').trim().length < 1 ? Promise.resolve([])
        : fetchTaxonomyLookup(input.trim()).then((list) => list.map((item) => ({ value: item.id, label: item.description, code: item.code }))));

    // End date enabled only when the recorded date is before today (legacy rule).
    const recordedDay = (form?.effectiveDate || '').split(' ')[0];
    const endDateEnabled = recordedDay && recordedDay !== today;

    const validate = () => {
        const next = {};
        if (form.npi && (form.npi.length !== 10 || !/^\d{10}$/.test(form.npi))) next.npi = form.npi.length !== 10 ? 'Minimum 10 characters.' : 'Invalid NPI.';
        if (!form.firstName) next.firstName = 'First Name is required.';
        else if (form.firstName.length > 25) next.firstName = 'Maximum 25 characters.';
        else if (!ONLY_ALPHA.test(form.firstName)) next.firstName = 'Only alphabets and single space are allowed.';
        if (form.middleName && !ONLY_ALPHA.test(form.middleName)) next.middleName = 'Only alphabets and single space are allowed.';
        if (!form.lastName) next.lastName = 'Last Name is required.';
        else if (form.lastName.length > 25) next.lastName = 'Maximum 25 characters.';
        else if (!ONLY_ALPHA.test(form.lastName)) next.lastName = 'Only alphabets and single space are allowed.';
        if (!form.specialtyId) next.specialtyId = 'Specialty is required.';
        if (!form.primaryCommunication) next.primaryCommunication = 'Primary Communication is required.';
        if (!form.effectiveDate) next.effectiveDate = 'Effective Date is required.';
        const phoneChecks = [['workPhone', 'CWPH', 'Work Phone'], ['mobilePhone', 'CMPH', 'Mobile Phone'], ['pagerPhone', 'CPNO', 'Pager Number']];
        phoneChecks.forEach(([key, comm, label]) => {
            if (!form[key] && form.primaryCommunication === comm) next[key] = `${label} is required.`;
            else if (form[key] && !PHONE_RE.test(form[key])) next[key] = `${label} is invalid.`;
        });
        if (!form.email && form.primaryCommunication === 'CEMA') next.email = 'Email is required.';
        else if (form.email && (form.email.length < 6 || form.email.length > 50 || !EMAIL_RE.test(form.email))) next.email = 'Email is Invalid.';
        // require_from_group: at least one phone
        if (!form.workPhone && !form.mobilePhone && !form.pagerPhone) {
            next.workPhone = next.workPhone || 'Please fill at least one phone number.';
        }
        return next;
    };

    const handleSave = async () => {
        const validation = validate();
        setErrors(validation);
        if (Object.keys(validation).length) return;
        setSaving(true);
        try {
            // Server-side duplicate check (legacy splPhysicianUniqueCheck).
            const uniqueResponse = await validateSpecialtyProviderUnique({
                patientId,
                healthCareProviderId: form.healthCareProviderId || '',
                firstName: form.firstName,
                middleName: form.middleName,
                lastName: form.lastName,
                mobilePhone: form.mobilePhone,
                homePhone: form.pagerPhone,
                workPhone: form.workPhone,
                npi: form.npi,
                email: form.email,
                effectiveDate: form.effectiveDate,
                lastEffectiveDate: form.lastEffectiveDate,
            });
            const isUnique = uniqueResponse === true || uniqueResponse === 'true' || uniqueResponse?.data === true;
            if (!isUnique) {
                setErrors((prev) => ({ ...prev, npi: `${ROLE_DESC_PROVIDER} already added for the selected date range.` }));
                setSaving(false);
                return;
            }
            const payload = {
                patientId,
                healthCareProviderId: form.healthCareProviderId || '',
                npi: form.npi,
                firstName: form.firstName,
                middleName: form.middleName,
                lastName: form.lastName,
                speciality: form.specialtyId || '',
                otherDescription: '',
                email: form.email,
                mobilePhone: form.mobilePhone,
                workPhone: form.workPhone,
                homePhone: form.pagerPhone,
                primaryCommunicationCode: form.primaryCommunication,
                effectiveDate: form.effectiveDate,
                lastEffectiveDate: form.lastEffectiveDate,
                activeFlag: 'Y',
                alertFlag: form.alertFlag ? 'Y' : 'N',
            };
            const response = await saveSpecialtyProvider(payload);
            if (response?.status === 'success') {
                notifySuccess(form.healthCareProviderId
                    ? `Patient specialty ${ROLE_DESC_PROVIDER.toLowerCase()} updated successfully.`
                    : `Patient specialty ${ROLE_DESC_PROVIDER.toLowerCase()} saved successfully.`);
                setDialog(null);
                load(recordType);
            }
            else notifyError(`Failed to save specialty ${ROLE_DESC_PROVIDER.toLowerCase()}. Please try again.`);
        }
        catch (error) { console.error(error); notifyError(`Failed to save specialty ${ROLE_DESC_PROVIDER.toLowerCase()}. Please try again.`); }
        finally { setSaving(false); }
    };

    const handleDelete = async (record) => {
        if (!window.confirm(`Are you sure about deleting the Specialty ${ROLE_DESC_PROVIDER} record?`)) return;
        try {
            const response = await deleteSpecialtyProvider({
                recordType, patientId,
                healthCareProviderId: record.healthCareProviderId,
                lastEffectiveDate: record.lastEffectiveDate,
            });
            if (response?.status === 'success') {
                notifySuccess(`Specialty ${ROLE_DESC_PROVIDER} record deleted successfully.`);
                load(recordType);
            }
            else notifyError('Failed to delete specialty physician details.');
        }
        catch (error) { console.error(error); notifyError('Failed to delete specialty physician details.'); }
    };

    const commNumber = (record) => (record.primaryCommunicationCode === 'CWPH' ? record.workPhone
        : record.primaryCommunicationCode === 'CMPH' ? record.mobilePhone : record.homePhone);

    return (<div className="mt-3">
      <div className="pp-accordion-item">
        <div className="pp-accordion-header" role="button" onClick={() => setOpen((prev) => !prev)}>
          <span>Specialty {ROLE_DESC_PROVIDER}</span>
          <LegacyIcon icon={open ? 'mdi-chevron-up' : 'mdi-chevron-down'}/>
        </div>
        {open && (<div className="p-2">
          <div className="d-flex align-items-center justify-content-between mx-2 flex-wrap gap-2">
            <ul className="nav nav-pills pp-soft-nav-pill mb-0">
              <li className="nav-item active-history-toggle-list">
                <button type="button" className={`nav-link active-history-nav-link small ${recordType === 'active' ? 'active' : ''}`} onClick={() => setRecordType('active')}>Active</button>
              </li>
              <li className="nav-item active-history-toggle-list">
                <button type="button" className={`nav-link active-history-nav-link small ${recordType === 'history' ? 'active' : ''}`} onClick={() => setRecordType('history')}>In-active</button>
              </li>
            </ul>
            <button type="button" className="btn btn-primary btn-md border-radius-button" onClick={() => openDialog(null)}>
              <LegacyIcon icon="mdi-plus"/> Specialty {ROLE_DESC_PROVIDER}s
            </button>
          </div>
          <div className="mt-2">
            {records === null && <SkeletonTable columns={['S.No', 'Specialty Provider', 'Recorded Date', 'Start Date', 'End Date', 'Specialty Physician Notes', '']} rows={4}/>}
            {records !== null && records.length === 0 && (
              <div className="text-center py-4 mx-3 my-3" style={{ border: '2px solid #ddd' }}>
                <LegacyIcon icon="mdi-information-outline" style={{ fontSize: 30, verticalAlign: 'sub' }}/>
                <span style={{ fontSize: 20 }}> Patient doesn&apos;t have any {recordType === 'active' ? `active specialty ${ROLE_DESC_PROVIDER.toLowerCase()}s` : `inactive ${ROLE_DESC_PROVIDER.toLowerCase()}s`} yet! </span>
              </div>
            )}
            {(records || []).map((record) => (
              <div className="pp-provider-card mx-2 d-flex gap-3" key={record.healthCareProviderId}>
                <div className="pp-member-avatar text-uppercase">{(record.firstName?.[0] || '') + (record.lastName?.[0] || '')}</div>
                <div className="flex-grow-1" style={{ minWidth: 0 }}>
                  <div className="d-flex justify-content-between align-items-start">
                    <span className="text-capitalize fw-bold">{record.firstName} {record.lastName}</span>
                    <div className="d-flex gap-3">
                      {recordType === 'active' && (
                        <span className="pp-record-action-icon edit" title="Edit" role="button" onClick={() => openDialog(record)}><LegacyIcon icon="fa-pen"/></span>
                      )}
                      <span className="pp-record-action-icon delete" title="Delete" role="button" onClick={() => handleDelete(record)}><LegacyIcon icon="fa-trash"/></span>
                    </div>
                  </div>
                  <div className="row mt-2 gy-1">
                    <div className="col-md-2 fw-bold">{record.specialityCode || '-'}</div>
                    <div className="col-md-3"><LegacyIcon icon="fa-phone" className="me-1"/><span className="fw-bold">{commNumber(record) || '-'}</span></div>
                    <div className="col-md-3"><LegacyIcon icon="fa-envelope" className="me-1"/><span className="fw-bold">{record.email || '-'}</span></div>
                    <div className="col-md-4">Alert Communication : <span className="fw-semibold">{record.alertFlag === 'Y' ? 'Yes' : 'No'}</span></div>
                  </div>
                  <div className="row mt-2 gy-1">
                    <div className="col-md-3 offset-md-2"><LegacyIcon icon="mdi-calendar-month-outline" className="me-1"/>Effective Date : <span className="fw-bold">{record.effectiveDate}</span></div>
                    <div className="col-md-4"><LegacyIcon icon="mdi-calendar-month-outline" className="me-1"/>Last Effective Date : <span className="fw-bold">{record.lastEffectiveDate || '-'}</span></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>)}
      </div>

      <Dialog visible={!!dialog} onHide={() => setDialog(null)}
        header={dialog?.record ? `Edit Specialty ${ROLE_DESC_PROVIDER}` : 'Specialty Provider Information'}
        style={{ width: '70vw' }} breakpoints={{ '992px': '98vw' }}>
        {form && (<form autoComplete="off" onSubmit={(e) => { e.preventDefault(); handleSave(); }} noValidate>
          <div className="row g-3">
            <div className="col-md-4">
              <label>NPI</label>
              <input type="text" className="form-control" placeholder="NPI" maxLength={10} value={form.npi} onChange={(e) => { update({ npi: e.target.value.replace(/\D/g, '') }); clearError('npi'); }}/>
              <FieldError message={errors.npi}/>
            </div>
            <div className="col-md-4">
              <label>Specialty Type <span className="text-danger">*</span></label>
              <AsyncSelect classNamePrefix="react-select" placeholder="Specialty" isClearable cacheOptions defaultOptions={false}
                loadOptions={loadSpecialty}
                value={form.specialtyId ? { value: form.specialtyId, label: form.specialtyLabel } : null}
                onChange={(option) => { update({ specialtyId: option?.value || '', specialtyLabel: option?.label || '' }); clearError('specialtyId'); }}
                noOptionsMessage={() => 'No matching specialty type found.'}/>
              <FieldError message={errors.specialtyId}/>
            </div>
          </div>
          <div className="row g-3 mt-1">
            <div className="col-md-4">
              <label>First Name <span className="text-danger">*</span></label>
              <input type="text" className="form-control" placeholder="First Name" maxLength={25} value={form.firstName} onChange={(e) => { update({ firstName: e.target.value }); clearError('firstName'); }}/>
              <FieldError message={errors.firstName}/>
            </div>
            <div className="col-md-4">
              <label>Middle Name</label>
              <input type="text" className="form-control" placeholder="Middle Name" maxLength={25} value={form.middleName} onChange={(e) => { update({ middleName: e.target.value }); clearError('middleName'); }}/>
              <FieldError message={errors.middleName}/>
            </div>
            <div className="col-md-4">
              <label>Last Name <span className="text-danger">*</span></label>
              <input type="text" className="form-control" placeholder="Last Name" maxLength={25} value={form.lastName} onChange={(e) => { update({ lastName: e.target.value }); clearError('lastName'); }}/>
              <FieldError message={errors.lastName}/>
            </div>
          </div>
          <div className="row g-3 mt-1">
            <div className="col-md-4">
              <label>Primary Communication <span className="text-danger">*</span></label>
              <select className="form-select" value={form.primaryCommunication} onChange={(e) => { update({ primaryCommunication: e.target.value }); clearError('primaryCommunication'); }}>
                <option value="">Select Primary Communication</option>
                {commMethods.map((method) => <option key={method.code} value={method.code}>{method.description}</option>)}
              </select>
              <FieldError message={errors.primaryCommunication}/>
            </div>
            <div className="col-md-4">
              <label>Effective Date <span className="text-danger">*</span></label>
              <FlatpickrDateTimeInput value={form.effectiveDate.split(' ')[0] || ''} enableTime={false} dateFormat="m-d-Y" placeholder="MM-DD-YYYY"
                minDate={dob || undefined} maxDate={today}
                onChange={(val) => { update({ effectiveDate: val ? `${val} 12:00 AM` : '', lastEffectiveDate: '' }); clearError('effectiveDate'); }}/>
              <FieldError message={errors.effectiveDate}/>
            </div>
            <div className="col-md-4">
              <label>Last Effective Date</label>
              <FlatpickrDateTimeInput value={form.lastEffectiveDate.split(' ')[0] || ''} enableTime={false} dateFormat="m-d-Y" placeholder="MM-DD-YYYY"
                disabled={!endDateEnabled} minDate={recordedDay || undefined} maxDate={today}
                onChange={(val) => update({ lastEffectiveDate: val || '' })}/>
            </div>
          </div>
          <div className="row g-3 mt-1">
            <div className="col-md-4">
              <label>Email</label>
              <input type="text" className="form-control" placeholder="Email" maxLength={50} value={form.email} onChange={(e) => { update({ email: e.target.value }); clearError('email'); }}/>
              <FieldError message={errors.email}/>
            </div>
            <div className="col-md-4">
              <label>Mobile Phone</label>
              <input type="text" className="form-control" placeholder="Mobile Phone" value={form.mobilePhone} onChange={(e) => { update({ mobilePhone: formatPhoneInput(e.target.value) }); clearError('mobilePhone'); }}/>
              <FieldError message={errors.mobilePhone}/>
            </div>
            <div className="col-md-4">
              <label>Pager Number</label>
              <input type="text" className="form-control" placeholder="Pager Phone" value={form.pagerPhone} onChange={(e) => { update({ pagerPhone: formatPhoneInput(e.target.value) }); clearError('pagerPhone'); }}/>
              <FieldError message={errors.pagerPhone}/>
            </div>
          </div>
          <div className="row g-3 mt-1">
            <div className="col-md-4">
              <label>Work Phone</label>
              <input type="text" className="form-control" placeholder="Work Phone" value={form.workPhone} onChange={(e) => { update({ workPhone: formatPhoneInput(e.target.value) }); clearError('workPhone'); }}/>
              <FieldError message={errors.workPhone}/>
            </div>
          </div>
          <div className="d-flex justify-content-between mt-3">
            <button type="button" className="btn btn-primary rounded-pill px-4" disabled={saving}
              onClick={() => { if (window.confirm(`Are you sure about cancel specialty ${ROLE_DESC_PROVIDER.toLowerCase()}s form?`)) setDialog(null); }}>Cancel</button>
            <button type="submit" className="btn btn-primary rounded-pill px-4" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>)}
      </Dialog>
    </div>);
};
export default PatientSpecialtyProviders;
