import { useEffect, useMemo, useState } from 'react';
import moment from '../../../utils/dayjs';
import Select from 'react-select';
import {
    buildHealthInsuranceSavePayload,
    fetchInsuranceMetadata,
    fetchPatientHealthInsurance,
    savePatientHealthInsurance,
} from '../../../services/healthInsuranceService';
import { fetchPatientDetails } from '../../../services/patientService';
import { getSaveOutcome } from '../../../utils/saveResponse';
import FlatpickrDateTimeInput from '../../../components/common/FlatpickrDateTimeInput';
import { LegacyIcon } from '../../../components/common/CustomIcons';
import US_STATES from '../../../constants/usStates';

const ALPHA_NUMERIC = /^[a-zA-Z0-9]*$/;
const PHONE_DIGITS = /\d/g;

const emptyAddressParty = () => ({
    number: '', phoneNumber: '', firstName: '', middleName: '', lastName: '', dob: '',
    addressLineOne: '', addressLineTwo: '', city: '', state: '', zipCode: '', country: 'USA',
});
const createDefaultForm = () => ({
    id: '', payerId: '', payerTypeCode: '', insuranceType: '', policyNumber: '', groupNumber: '',
    groupName: '', effectiveDate: moment().format('MM-DD-YYYY'), lastEffectiveDate: '',
    insuranceStatusCode: 'ACTIVE', qualifiedMedicareBeneficiary: false,
    subscriber: { relationShipTypeId: '', otherRelationShip: '', ...emptyAddressParty() },
    member: emptyAddressParty(),
});

const getPrimaryPhone = (details = {}) => {
    switch (details.primaryCommunication) {
        case 'CHPH': return details.homePhoneNumber || details.homePhone || '';
        case 'CWPH': return details.workPhoneNumber || details.workPhone || '';
        case 'CMPH': return details.mobilePhoneNumber || details.mobilePhone || '';
        default: return '';
    }
};

const FieldError = ({ message }) => message ? <div className="small text-danger mt-1">{message}</div> : null;

const AddressFields = ({ data, prefix, disabled, onField }) => (<>
  <div className="row g-2 mt-1">
    <div className="col-md-4"><label className="form-label">Address Line One</label>
      <input className="form-control text-capitalize" value={data.addressLineOne} disabled={disabled} onChange={(e) => onField('addressLineOne', e.target.value)}/></div>
    <div className="col-md-4"><label className="form-label">Address Line Two</label>
      <input className="form-control text-capitalize" value={data.addressLineTwo} disabled={disabled} onChange={(e) => onField('addressLineTwo', e.target.value)}/></div>
    <div className="col-md-4"><label className="form-label">City</label>
      <input id={`${prefix}_city`} className="form-control text-capitalize" value={data.city} disabled={disabled} onChange={(e) => onField('city', e.target.value)}/></div>
  </div>
  <div className="row g-2 mt-1">
    <div className="col-md-4"><label className="form-label">State</label>
      <select className="form-control form-select" value={data.state} disabled={disabled} onChange={(e) => onField('state', e.target.value)}>
        <option value="">Select State</option>
        {US_STATES.map((code) => <option key={code} value={code}>{code}</option>)}
      </select></div>
    <div className="col-md-4"><label className="form-label">Zip Code</label>
      <input className="form-control" value={data.zipCode} disabled={disabled} maxLength={5} onChange={(e) => onField('zipCode', e.target.value.replace(/[^0-9]/g, ''))}/></div>
    <div className="col-md-4"><label className="form-label">Country</label>
      <input className="form-control text-capitalize" value={data.country} disabled/></div>
  </div>
</>);

const PatientHealthInsuranceAddEdit = ({ patientId, record, onClose }) => {
    const isEdit = !!record?.id;
    const [form, setForm] = useState(createDefaultForm);
    const [metadata, setMetadata] = useState({ insuranceTypes: [], relationships: [], statuses: [], providers: [], payerTypes: [] });
    const [activeList, setActiveList] = useState([]);
    const [awvEditable, setAwvEditable] = useState('Y');
    const [patientDetails, setPatientDetails] = useState(null);
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);
    const [subscriberOpen, setSubscriberOpen] = useState(true);
    const [memberOpen, setMemberOpen] = useState(false);

    const relationshipCode = useMemo(() => {
        const match = metadata.relationships.find((r) => String(r.id) === String(form.subscriber.relationShipTypeId));
        return match?.code || '';
    }, [metadata.relationships, form.subscriber.relationShipTypeId]);
    const isSelf = relationshipCode === 'SELF';
    const isOther = relationshipCode === 'OTH';
    const isMedicareProvider = form.payerTypeCode === '1';
    const showLastEffective = !isMedicareProvider;
    const showQmb = form.insuranceType === 'PRIMARY';

    const updateRoot = (patch) => setForm((p) => ({ ...p, ...patch }));
    const updateSubscriber = (key, value) => setForm((p) => ({ ...p, subscriber: { ...p.subscriber, [key]: value } }));
    const updateMember = (key, value) => setForm((p) => ({ ...p, member: { ...p.member, [key]: value } }));
    const clearError = (key) => setErrors((prev) => { if (!prev[key]) return prev; const n = { ...prev }; delete n[key]; return n; });

    // ---- load reference data, active list (for disabling), patient details ----
    useEffect(() => {
        let ignore = false;
        (async () => {
            try {
                const [meta, active, detailsResponse] = await Promise.all([
                    fetchInsuranceMetadata(),
                    fetchPatientHealthInsurance({ patientId, recordType: 'active' }),
                    fetchPatientDetails(patientId),
                ]);
                if (ignore) return;
                setMetadata(meta);
                setActiveList(active.insuranceList || []);
                setAwvEditable(active.awvConfigurationEditableFlag || 'Y');
                // /patient/details nests the demographics under data.patientDetails.
                setPatientDetails(detailsResponse?.status === 'success' ? (detailsResponse.data?.patientDetails || null) : null);
            }
            catch (error) {
                console.error('Failed to load health insurance form data.', error);
            }
        })();
        return () => { ignore = true; };
    }, [patientId]);

    // ---- edit-mode populate ----
    useEffect(() => {
        if (!isEdit) return;
        setForm({
            id: record.id || '',
            payerId: record.payerId || '',
            payerTypeCode: record.payerTypeCode || '',
            insuranceType: record.insuranceTypeCode || '',
            policyNumber: record.policyNumber || '',
            groupNumber: record.groupNumber || '',
            groupName: record.groupName || '',
            effectiveDate: record.effectiveDate || '',
            lastEffectiveDate: record.lastEffectiveDate || '',
            insuranceStatusCode: record.insuranceStatusCode || '',
            qualifiedMedicareBeneficiary: record.qualifiedMedicareBeneficiaryFlag === 'Y',
            subscriber: {
                relationShipTypeId: record.relationShipTypeId || '',
                otherRelationShip: record.otherRelationShip || '',
                number: record.subscriberNumber || '', phoneNumber: record.subscriberPhoneNumber || '',
                firstName: record.subscriberFirstName || '', middleName: record.subscriberMiddleName || '', lastName: record.subscriberLastName || '',
                dob: record.subscriberDOB || '', addressLineOne: record.subscriberAddressLineOne || '', addressLineTwo: record.subscriberAddressLineTwo || '',
                city: record.subscriberCity || '', state: (record.subscriberState || '').toUpperCase(), zipCode: record.subscriberZipCode || '', country: (record.subscriberCountry || 'USA').toUpperCase(),
            },
            member: {
                number: record.memberNumber || '', phoneNumber: record.memberPhoneNumber || '',
                firstName: record.memberFirstName || '', middleName: record.memberMiddleName || '', lastName: record.memberLastName || '',
                dob: record.memberDOB || '', addressLineOne: record.memberAddressLineOne || '', addressLineTwo: record.memberAddressLineTwo || '',
                city: record.memberCity || '', state: (record.memberState || '').toUpperCase(), zipCode: record.memberZipCode || '', country: (record.memberCountry || 'USA').toUpperCase(),
            },
        });
        if (record.relationShipTypeCode && record.relationShipTypeCode !== 'SELF') setMemberOpen(true);
    }, [record, isEdit]);

    // ---- relationship change: SELF auto-fills subscriber from patient + disables member; others fill member ----
    const handleRelationshipChange = (relationShipTypeId) => {
        const match = metadata.relationships.find((r) => String(r.id) === String(relationShipTypeId));
        const code = match?.code || '';
        clearError('relationShipTypeId');
        setForm((p) => {
            const next = { ...p, subscriber: { ...p.subscriber, relationShipTypeId } };
            const details = patientDetails || {};
            if (code === 'SELF') {
                next.subscriber = {
                    ...next.subscriber,
                    firstName: details.firstName || '', middleName: details.middleName || '', lastName: details.lastName || '',
                    dob: details.dateOfBirth || '', number: p.policyNumber || '', phoneNumber: getPrimaryPhone(details),
                    addressLineOne: details.addressLineOne || '', addressLineTwo: details.addressLineTwo || '',
                    city: details.city || '', state: (details.state || '').toUpperCase(), zipCode: details.zipCode || '', country: 'USA',
                };
            }
            else if (code) {
                next.member = {
                    ...next.member,
                    firstName: details.firstName || '', middleName: details.middleName || '', lastName: details.lastName || '',
                    dob: details.dateOfBirth || '', phoneNumber: getPrimaryPhone(details),
                    addressLineOne: details.addressLineOne || '', addressLineTwo: details.addressLineTwo || '',
                    city: details.city || '', state: (details.state || '').toUpperCase(), zipCode: details.zipCode || '', country: 'USA',
                };
            }
            return next;
        });
        if (code === 'SELF') { setMemberOpen(false); }
        else if (code) { setMemberOpen(true); }
    };

    const handleProviderChange = (option) => {
        clearError('payerId');
        updateRoot({ payerId: option?.value || '', payerTypeCode: option?.payerTypeCode || '' });
    };
    const handlePolicyChange = (value) => {
        // Legacy: when relationship is SELF, mirror the policy number into the subscriber number.
        setForm((p) => ({ ...p, policyNumber: value, subscriber: isSelf ? { ...p.subscriber, number: value } : p.subscriber }));
        clearError('policyNumber');
    };

    // ---- options ----
    const medicareAlreadyAdded = useMemo(() => activeList.some((i) => i.payerTypeCode === '1'), [activeList]);
    const addedInsuranceTypes = useMemo(() => activeList.map((i) => i.insuranceTypeCode), [activeList]);
    const providerOptions = useMemo(() => (metadata.providers || []).map((p) => ({
        value: p.id, label: p.nameWithType, payerTypeCode: p.payerTypeCode,
        isDisabled: medicareAlreadyAdded && p.payerTypeCode === '1' && (!isEdit || String(p.id) !== String(record?.payerId)),
    })), [metadata.providers, medicareAlreadyAdded, isEdit, record]);

    const lastEffectiveMin = form.effectiveDate ? moment(form.effectiveDate, 'MM-DD-YYYY').add(1, 'day').format('MM-DD-YYYY') : undefined;
    const lastEffectiveMax = form.insuranceStatusCode === 'CANCELLED'
        ? 'today'
        : (form.effectiveDate ? moment(form.effectiveDate, 'MM-DD-YYYY').add(50, 'years').format('MM-DD-YYYY') : undefined);

    const validate = () => {
        const next = {};
        if (!form.insuranceType) next.insuranceType = 'Insurance type is required.';
        if (!form.payerId) next.payerId = 'Insurance Provider is required.';
        if (!form.policyNumber) next.policyNumber = 'Policy Number is required.';
        else if (!ALPHA_NUMERIC.test(form.policyNumber) || form.policyNumber.length > 50) next.policyNumber = 'Maximum 50 alphanumeric characters.';
        if (form.groupNumber && form.groupNumber.length > 50) next.groupNumber = 'Maximum 50 characters.';
        if (!form.effectiveDate) next.effectiveDate = 'Effective date is required.';
        if (!form.insuranceStatusCode) next.insuranceStatusCode = 'Insurance Status is required';
        if (form.insuranceStatusCode === 'CANCELLED' && !form.lastEffectiveDate) next.lastEffectiveDate = 'Last Effective Date is required.';
        // subscriber
        if (!form.subscriber.relationShipTypeId) next.relationShipTypeId = 'Subscriber type is required.';
        if (isOther && !form.subscriber.otherRelationShip.trim()) next.otherRelationShip = 'Other relationship is required.';
        if (!form.subscriber.number) next.subscriberNumber = 'Subscriber number is required.';
        else if (!ALPHA_NUMERIC.test(form.subscriber.number) || form.subscriber.number.length > 50) next.subscriberNumber = 'Maximum 50 alphanumeric characters.';
        if (!form.subscriber.firstName.trim()) next.subscriberFirstName = 'First name is required.';
        if (!form.subscriber.lastName.trim()) next.subscriberLastName = 'Last name is required.';
        if (!form.subscriber.dob) next.subscriberDob = 'Date of birth is required.';
        if (form.subscriber.phoneNumber && (form.subscriber.phoneNumber.match(PHONE_DIGITS) || []).length !== 10) next.subscriberPhone = 'Phone number is invalid.';
        // member (only when not SELF)
        if (!isSelf) {
            if (!form.member.number) next.memberNumber = 'Member number is required';
            if (!form.member.firstName.trim()) next.memberFirstName = 'First name is required.';
            if (!form.member.lastName.trim()) next.memberLastName = 'Last name is required.';
            if (!form.member.dob) next.memberDob = 'Date of birth is required.';
            if (form.member.phoneNumber && (form.member.phoneNumber.match(PHONE_DIGITS) || []).length !== 10) next.memberPhone = 'Phone number is invalid.';
        }
        return next;
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setSaveError(null);
        const validationErrors = validate();
        setErrors(validationErrors);
        if (Object.keys(validationErrors).length) {
            // expand panels that contain errors (legacy expandSubscriberAndMembersPanel)
            if (['relationShipTypeId', 'otherRelationShip', 'subscriberNumber', 'subscriberFirstName', 'subscriberLastName', 'subscriberDob', 'subscriberPhone'].some((k) => validationErrors[k])) setSubscriberOpen(true);
            if (['memberNumber', 'memberFirstName', 'memberLastName', 'memberDob', 'memberPhone'].some((k) => validationErrors[k])) setMemberOpen(true);
            return;
        }
        setSaving(true);
        try {
            const payload = buildHealthInsuranceSavePayload({ patientId, form: { ...form, relationshipCode } });
            const response = await savePatientHealthInsurance(payload);
            const outcome = getSaveOutcome(response, 'Failed to update Health insurance details. Please try again.');
            if (outcome.ok) { onClose(true); return; }
            setSaveError(outcome);
        }
        catch (error) {
            console.error('Failed to save health insurance.', error);
            setSaveError({ tone: 'error', message: error?.message || 'Failed to update Health insurance details. Please try again.' });
        }
        finally {
            setSaving(false);
        }
    };

    const isMedicareEdit = isEdit && form.payerTypeCode === '1';

    return (<div className="patient-health-insurance-add-edit p-3">
      <div className="d-flex align-items-center gap-2 border-bottom pb-2 mb-3">
        <button type="button" className="btn btn-link p-0 text-dark" onClick={() => onClose(false)} aria-label="Back to insurance list"><LegacyIcon icon="mdi-arrow-left" className="fs-4"/></button>
        <span className="fw-bold">{isEdit ? 'Edit' : 'Add'} Health Insurance</span>
      </div>
      <form className="care-plan-data-entry" onSubmit={handleSubmit} noValidate>
        {/* Insurance */}
        <div className="row g-3">
          <div className="col-md-4">
            <label className="form-label fw-bold">Coverage Priority <span className="text-danger">*</span></label>
            <select className="form-control form-select" value={form.insuranceType} onChange={(e) => { updateRoot({ insuranceType: e.target.value, qualifiedMedicareBeneficiary: e.target.value === 'PRIMARY' ? form.qualifiedMedicareBeneficiary : false }); clearError('insuranceType'); }}>
              <option value="">Select Coverage Priority</option>
              {metadata.insuranceTypes.map((type) => {
                const disabled = addedInsuranceTypes.includes(type.code) && type.code !== 'OTHINS' && (!isEdit || type.code !== form.insuranceType);
                return <option key={type.code} value={type.code} disabled={disabled}>{type.description}{disabled ? ' (Insurance already added)' : ''}</option>;
              })}
            </select>
            <FieldError message={errors.insuranceType}/>
          </div>
          <div className="col-md-4">
            <label className="form-label fw-bold">Insurance Provider Name <span className="text-danger">*</span></label>
            <Select classNamePrefix="react-select" placeholder="Select Insurance Provider" isClearable isDisabled={isMedicareEdit} options={providerOptions} value={providerOptions.find((o) => String(o.value) === String(form.payerId)) || null} onChange={handleProviderChange}/>
            <FieldError message={errors.payerId}/>
          </div>
          <div className="col-md-4">
            <label className="form-label fw-bold">Policy Number <span className="text-danger">*</span></label>
            <input className="form-control text-uppercase" maxLength={200} value={form.policyNumber} onChange={(e) => handlePolicyChange(e.target.value)}/>
            <FieldError message={errors.policyNumber}/>
          </div>
        </div>
        <div className="row g-3 mt-1">
          <div className="col-md-4">
            <label className="form-label fw-bold">Group Number</label>
            <input className="form-control text-capitalize" maxLength={200} value={form.groupNumber} onChange={(e) => { updateRoot({ groupNumber: e.target.value }); clearError('groupNumber'); }}/>
            <FieldError message={errors.groupNumber}/>
          </div>
          <div className="col-md-4">
            <label className="form-label fw-bold">Group Name</label>
            <input className="form-control text-capitalize" maxLength={200} value={form.groupName} onChange={(e) => updateRoot({ groupName: e.target.value })}/>
          </div>
          <div className="col-md-4">
            <label className="form-label fw-bold">Effective Date <span className="text-danger">*</span></label>
            <FlatpickrDateTimeInput value={form.effectiveDate} onChange={(v) => { updateRoot({ effectiveDate: v }); clearError('effectiveDate'); }} disabled={isMedicareEdit && awvEditable === 'N'} enableTime={false} dateFormat="m-d-Y" placeholder="MM-DD-YYYY" maxDate="today"/>
            <FieldError message={errors.effectiveDate}/>
          </div>
        </div>
        <div className="row g-3 mt-1">
          {showLastEffective && (<div className="col-md-4">
              <label className="form-label fw-bold">Last Effective Date {form.insuranceStatusCode === 'CANCELLED' && <span className="text-danger">*</span>}</label>
              <FlatpickrDateTimeInput value={form.lastEffectiveDate} onChange={(v) => { updateRoot({ lastEffectiveDate: v }); clearError('lastEffectiveDate'); }} enableTime={false} dateFormat="m-d-Y" placeholder="MM-DD-YYYY" minDate={lastEffectiveMin} maxDate={lastEffectiveMax}/>
              <FieldError message={errors.lastEffectiveDate}/>
            </div>)}
          <div className="col-md-4">
            <label className="form-label fw-bold">Insurance Status <span className="text-danger">*</span></label>
            <select className="form-control form-select" value={form.insuranceStatusCode} onChange={(e) => { updateRoot({ insuranceStatusCode: e.target.value }); clearError('insuranceStatusCode'); clearError('lastEffectiveDate'); }}>
              <option value="">Select Insurance Status</option>
              {metadata.statuses.map((s) => <option key={s.code} value={s.code}>{s.description}</option>)}
            </select>
            <FieldError message={errors.insuranceStatusCode}/>
          </div>
          {showQmb && (<div className="col-md-4 d-flex align-items-end">
              <label className="form-check-label d-flex align-items-center gap-2 mb-2">
                <input type="checkbox" className="form-check-input mt-0" checked={form.qualifiedMedicareBeneficiary} onChange={(e) => updateRoot({ qualifiedMedicareBeneficiary: e.target.checked })}/>
                Qualified Medicare Beneficiary
              </label>
            </div>)}
        </div>

        {/* Subscriber */}
        <button type="button" className="btn btn-primary pc-collapse-btn collapse-btn mt-3 w-100 text-start d-flex justify-content-between align-items-center" onClick={() => setSubscriberOpen((v) => !v)}>
          Subscriber <LegacyIcon icon={subscriberOpen ? 'mdi-chevron-up' : 'mdi-chevron-down'}/>
        </button>
        {subscriberOpen && (<div className="card card-body mt-0">
            <div className="row g-2">
              <div className="col-md-4"><label className="form-label">Subscriber Type <span className="text-danger">*</span></label>
                <select className="form-control form-select text-capitalize" value={form.subscriber.relationShipTypeId} onChange={(e) => handleRelationshipChange(e.target.value)}>
                  <option value="">Select Subscriber Type</option>
                  {metadata.relationships.map((r) => <option key={r.id} value={r.id} data-code={r.code}>{r.description}</option>)}
                </select>
                <FieldError message={errors.relationShipTypeId}/></div>
              <div className="col-md-4"><label className="form-label">Subscriber Number <span className="text-danger">*</span></label>
                <input className="form-control text-uppercase" maxLength={200} value={form.subscriber.number} onChange={(e) => { updateSubscriber('number', e.target.value); clearError('subscriberNumber'); }}/>
                <FieldError message={errors.subscriberNumber}/></div>
              <div className="col-md-4"><label className="form-label">Phone Number</label>
                <input className="form-control" maxLength={200} value={form.subscriber.phoneNumber} onChange={(e) => { updateSubscriber('phoneNumber', e.target.value); clearError('subscriberPhone'); }}/>
                <FieldError message={errors.subscriberPhone}/></div>
            </div>
            {isOther && (<div className="row g-2 mt-1"><div className="col-md-4"><label className="form-label">Other Relationship <span className="text-danger">*</span></label>
                <input className="form-control text-capitalize" maxLength={200} value={form.subscriber.otherRelationShip} onChange={(e) => { updateSubscriber('otherRelationShip', e.target.value); clearError('otherRelationShip'); }}/>
                <FieldError message={errors.otherRelationShip}/></div></div>)}
            <div className="row g-2 mt-1">
              <div className="col-md-4"><label className="form-label">First Name <span className="text-danger">*</span></label>
                <input className="form-control text-capitalize" maxLength={200} value={form.subscriber.firstName} onChange={(e) => { updateSubscriber('firstName', e.target.value); clearError('subscriberFirstName'); }}/>
                <FieldError message={errors.subscriberFirstName}/></div>
              <div className="col-md-4"><label className="form-label">Middle Name</label>
                <input className="form-control text-capitalize" maxLength={200} value={form.subscriber.middleName} onChange={(e) => updateSubscriber('middleName', e.target.value)}/></div>
              <div className="col-md-4"><label className="form-label">Last Name <span className="text-danger">*</span></label>
                <input className="form-control text-capitalize" maxLength={200} value={form.subscriber.lastName} onChange={(e) => { updateSubscriber('lastName', e.target.value); clearError('subscriberLastName'); }}/>
                <FieldError message={errors.subscriberLastName}/></div>
            </div>
            <div className="row g-2 mt-1">
              <div className="col-md-4"><label className="form-label">Date Of Birth <span className="text-danger">*</span></label>
                <FlatpickrDateTimeInput value={form.subscriber.dob} onChange={(v) => { updateSubscriber('dob', v); clearError('subscriberDob'); }} enableTime={false} dateFormat="m-d-Y" placeholder="MM-DD-YYYY" maxDate="today"/>
                <FieldError message={errors.subscriberDob}/></div>
            </div>
            <AddressFields data={form.subscriber} prefix="phid_subscriber" disabled={false} onField={updateSubscriber}/>
          </div>)}

        {/* Member */}
        <button type="button" className="btn btn-primary pc-collapse-btn collapse-btn mt-3 w-100 text-start d-flex justify-content-between align-items-center" disabled={isSelf} onClick={() => setMemberOpen((v) => !v)}>
          Member {isSelf && <span className="small ms-2">( If the patient is a subscriber, the member option is disabled.)</span>}
          <LegacyIcon icon={memberOpen ? 'mdi-chevron-up' : 'mdi-chevron-down'}/>
        </button>
        {memberOpen && !isSelf && (<div className="card card-body mt-0">
            <div className="row g-2">
              <div className="col-md-4"><label className="form-label">Member Number <span className="text-danger">*</span></label>
                <input className="form-control text-capitalize" maxLength={200} value={form.member.number} onChange={(e) => { updateMember('number', e.target.value); clearError('memberNumber'); }}/>
                <FieldError message={errors.memberNumber}/></div>
              <div className="col-md-4"><label className="form-label">Date Of Birth <span className="text-danger">*</span></label>
                <FlatpickrDateTimeInput value={form.member.dob} onChange={(v) => { updateMember('dob', v); clearError('memberDob'); }} enableTime={false} dateFormat="m-d-Y" placeholder="MM-DD-YYYY" maxDate="today"/>
                <FieldError message={errors.memberDob}/></div>
              <div className="col-md-4"><label className="form-label">Phone Number</label>
                <input className="form-control" maxLength={200} value={form.member.phoneNumber} onChange={(e) => { updateMember('phoneNumber', e.target.value); clearError('memberPhone'); }}/>
                <FieldError message={errors.memberPhone}/></div>
            </div>
            <div className="row g-2 mt-1">
              <div className="col-md-4"><label className="form-label">First Name <span className="text-danger">*</span></label>
                <input className="form-control text-capitalize" maxLength={200} value={form.member.firstName} onChange={(e) => { updateMember('firstName', e.target.value); clearError('memberFirstName'); }}/>
                <FieldError message={errors.memberFirstName}/></div>
              <div className="col-md-4"><label className="form-label">Middle Name</label>
                <input className="form-control text-capitalize" maxLength={200} value={form.member.middleName} onChange={(e) => updateMember('middleName', e.target.value)}/></div>
              <div className="col-md-4"><label className="form-label">Last Name <span className="text-danger">*</span></label>
                <input className="form-control text-capitalize" maxLength={200} value={form.member.lastName} onChange={(e) => { updateMember('lastName', e.target.value); clearError('memberLastName'); }}/>
                <FieldError message={errors.memberLastName}/></div>
            </div>
            <AddressFields data={form.member} prefix="phid_member" disabled={false} onField={updateMember}/>
          </div>)}

        {saveError && (<div className={`mt-3 small ${saveError.tone === 'warning' ? 'text-warning' : 'text-danger'}`}><LegacyIcon icon="fa-exclamation-triangle" className="me-1"/>{saveError.message}</div>)}

        <div className="d-flex justify-content-end gap-2 mt-4 pt-3 border-top">
          <button type="button" className="btn btn-secondary px-4 rounded-pill" onClick={() => onClose(false)} disabled={saving}>Cancel</button>
          <button type="submit" className="btn btn-primary px-4 rounded-pill" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </form>
    </div>);
};
export default PatientHealthInsuranceAddEdit;
