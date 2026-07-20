import { useCallback, useEffect, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import {
    getPatientDetails, refreshPatientDetails, fetchPreviousAddressList,
    validateZipCode, saveAddressInformation,
} from '../../../services/patientProfileService';
import US_STATES from '../../../constants/usStates';
import { SkeletonViewDetails } from '../../../components/common/ContentLoader';
import { LegacyIcon } from '../../../components/common/CustomIcons';
import { useNotify } from '../../../context/NotificationContext';

const FieldError = ({ message }) => (message ? <div className="small text-danger mt-1">{message}</div> : null);

const AddressRow = ({ address, isPrevious }) => (
    <>
      <div className="row mx-md-3 my-3">
        <div className="col-md-3 col-6"><div className="pp-label">Address Line One</div><div className="fw-bold text-capitalize">{(isPrevious ? address.addressLine_1 : address.addressLineOne) || '-'}</div></div>
        <div className="col-md-3 col-6"><div className="pp-label">Address Line Two</div><div className="fw-bold text-capitalize">{(isPrevious ? address.addressLine_2 : address.addressLineTwo) || '-'}</div></div>
        <div className="col-md-3 col-6"><div className="pp-label">City</div><div className="fw-bold text-capitalize">{address.city || '-'}</div></div>
      </div>
      <div className="row mx-md-3 my-3">
        <div className="col-md-3 col-6"><div className="pp-label">State</div><div className="fw-bold text-uppercase">{address.state || '-'}</div></div>
        <div className="col-md-3 col-6"><div className="pp-label">Zip Code</div><div className="fw-bold">{address.zipCode || '-'}</div></div>
        <div className="col-md-3 col-6"><div className="pp-label">Country</div><div className="fw-bold text-uppercase">{address.country || 'USA'}</div></div>
      </div>
    </>
);

/**
 * Residential Information (legacy patient-address-information-*): current
 * address card with Add New / Edit (modal form), and the previous-address
 * timeline. Save → POST /patient/address/saveOrUpdate.
 */
const PatientAddressInformation = ({ patientId }) => {
    const { notifySuccess, notifyError } = useNotify();
    const [details, setDetails] = useState(null);
    const [previousAddresses, setPreviousAddresses] = useState([]);
    const [dialog, setDialog] = useState(null); // { isEdit }
    const [form, setForm] = useState(null);
    const [errors, setErrors] = useState({});
    const [zipInvalid, setZipInvalid] = useState(false);
    const [cityOptions, setCityOptions] = useState([]);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);

    const load = useCallback(async () => {
        try {
            const [patientDetails, previous] = await Promise.all([getPatientDetails(patientId), fetchPreviousAddressList(patientId)]);
            setDetails(patientDetails);
            setPreviousAddresses(previous);
        }
        catch (error) { console.error('Failed to load address information.', error); }
    }, [patientId]);
    useEffect(() => { load(); }, [load]);

    const openDialog = (isEdit) => {
        setForm({
            addressId: isEdit ? details.addressId || '' : '',
            addressLineOne: isEdit ? details.addressLineOne || '' : '',
            addressLineTwo: isEdit ? details.addressLineTwo || '' : '',
            city: isEdit ? details.city || '' : '',
            state: isEdit ? (details.state || '').toUpperCase() : '',
            zipCode: isEdit ? details.zipCode || '' : '',
        });
        setErrors({});
        setZipInvalid(false);
        setCityOptions([]);
        setDirty(false);
        setDialog({ isEdit });
    };

    const update = (patch) => { setForm((prev) => ({ ...prev, ...patch })); setDirty(true); };
    const clearError = (key) => setErrors((prev) => { if (!prev[key]) return prev; const next = { ...prev }; delete next[key]; return next; });

    // Legacy zip-code service: autofills city/state, flags unknown zips.
    const handleZipChange = async (zip) => {
        update({ zipCode: zip });
        clearError('zipCode');
        setZipInvalid(false);
        if (!/^\d{5}$/.test(zip)) return;
        try {
            const list = await validateZipCode(zip);
            if (list === null) { notifyError('Failed to validate zip code. Please try again.'); return; }
            if (list.length) {
                update({ zipCode: zip, city: list[0].city, state: list[0].state });
                setCityOptions(list.map((entry) => entry.city));
            }
            else setZipInvalid(true);
        }
        catch (error) { console.error(error); notifyError('Failed to validate zip code. Please try again.'); }
    };

    const validate = () => {
        const next = {};
        const lineOne = form.addressLineOne.trim();
        const anyOther = form.addressLineTwo.trim() || form.state.trim() || form.city.trim() || form.zipCode.trim();
        if (!lineOne && anyOther) next.addressLineOne = 'Please enter Address Line One.';
        else if (lineOne && lineOne.length < 3) next.addressLineOne = 'Minimum 3 characters.';
        else if (lineOne.length > 100) next.addressLineOne = 'Maximum 100 characters.';
        if (lineOne) {
            if (!form.city.trim()) next.city = 'City field cannot be left blank.';
            else if (form.city.trim().length < 3) next.city = 'Minimum 3 characters.';
            else if (form.city.trim().length > 25) next.city = 'Maximum 25 characters.';
            if (!form.state.trim()) next.state = 'State selection is required.';
            if (!form.zipCode.trim()) next.zipCode = 'Zip Code must be provided.';
            else if (!/^\d{5}$/.test(form.zipCode.trim())) next.zipCode = form.zipCode.trim().length !== 5 ? 'Minimum 5 characters.' : 'Zip code is invalid.';
        }
        return next;
    };

    const handleSave = async () => {
        const validation = validate();
        setErrors(validation);
        if (Object.keys(validation).length) return;
        setSaving(true);
        try {
            const response = await saveAddressInformation({
                patientId,
                addressId: form.addressId,
                addressLineOne: form.addressLineOne,
                addressLineTwo: form.addressLineTwo,
                city: form.city,
                state: form.state,
                zipCode: form.zipCode,
                country: 'USA',
            });
            if (response?.status === 'success') {
                notifySuccess('Patient address information updated successfully');
                await refreshPatientDetails(patientId);
                setDialog(null);
                load();
            }
            else notifyError('Failed to update patient address information. Please try again.');
        }
        catch (error) { console.error('Failed to save address.', error); notifyError('Failed to update patient address information. Please try again.'); }
        finally { setSaving(false); }
    };

    const handleCancel = () => {
        if (!dirty || window.confirm('Are you sure you want to cancel?')) setDialog(null);
    };

    if (!details) return <SkeletonViewDetails rows={2} cols={3}/>;

    return (<div className="ps-md-2">
      <div className="pp-address-card p-2 mt-3">
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 px-2">
          <div className="fw-bold"><LegacyIcon icon="fa-house" className="me-2"/>Current Address</div>
          <div className="d-flex align-items-center gap-2">
            <button type="button" className="btn btn-primary border-radius-button" style={{ width: 'auto' }} onClick={() => openDialog(false)}>Add New Address</button>
            <button type="button" className="btn pp-edit-btn-outline" title="Edit Address Information" onClick={() => openDialog(true)}>
              <LegacyIcon icon="mdi-pencil" className="me-1"/>Edit
            </button>
          </div>
        </div>
        <AddressRow address={details} isPrevious={false}/>
      </div>

      <div className="pp-address-card p-2 mt-3">
        <div className="fw-bold px-2"><LegacyIcon icon="fa-house" className="me-2"/>Previous Address</div>
        {previousAddresses.length === 0 && <div className="text-muted px-3 py-2">-</div>}
        {previousAddresses.map((address, index) => (
          <div className="d-flex mt-2" key={address.addressId || index}>
            <div className="d-flex flex-column gap-2 align-items-center" style={{ margin: '3px 0px 0px 6px' }}>
              <LegacyIcon icon="mdi-circle" className="pp-prev-address-dot"/>
              <div className="pp-prev-address-line"/>
            </div>
            <div className="flex-grow-1"><AddressRow address={address} isPrevious/></div>
          </div>
        ))}
      </div>

      <Dialog visible={!!dialog} onHide={handleCancel} header={dialog?.isEdit ? 'Edit Current Address' : 'Add New Address'} style={{ width: '60vw' }} breakpoints={{ '992px': '95vw' }}>
        {form && (<form autoComplete="off" onSubmit={(e) => { e.preventDefault(); handleSave(); }} noValidate>
          <div className="row g-3">
            <div className="col-md-4">
              <label>Address Line One</label>
              <input type="text" className="form-control" placeholder="Address Line One" maxLength={200} value={form.addressLineOne} onChange={(e) => { update({ addressLineOne: e.target.value }); clearError('addressLineOne'); }}/>
              <FieldError message={errors.addressLineOne}/>
            </div>
            <div className="col-md-4">
              <label>Address Line Two</label>
              <input type="text" className="form-control" placeholder="Address Line Two" maxLength={200} value={form.addressLineTwo} onChange={(e) => update({ addressLineTwo: e.target.value })}/>
            </div>
            <div className="col-md-4">
              <label>City</label>
              <input type="text" className="form-control" placeholder="City" maxLength={100} list={`address_city_list_${patientId}`} value={form.city} onChange={(e) => { update({ city: e.target.value }); clearError('city'); }}/>
              <datalist id={`address_city_list_${patientId}`}>{cityOptions.map((city) => <option key={city} value={city}/>)}</datalist>
              <FieldError message={errors.city}/>
            </div>
          </div>
          <div className="row g-3 mt-1">
            <div className="col-md-4">
              <label>State</label>
              <select className="form-select" value={form.state} onChange={(e) => { update({ state: e.target.value }); clearError('state'); }}>
                <option value="">State</option>
                {US_STATES.map((state) => <option key={state} value={state}>{state}</option>)}
              </select>
              <FieldError message={errors.state}/>
            </div>
            <div className="col-md-4">
              <label>Zip Code</label>
              <input type="text" className="form-control" placeholder="Zip Code" maxLength={5} value={form.zipCode} onChange={(e) => handleZipChange(e.target.value.replace(/\D/g, ''))}/>
              {zipInvalid && <div className="small text-danger mt-1"><LegacyIcon icon="fa-exclamation-triangle" className="me-1"/><b>Invalid Zip Code</b></div>}
              <FieldError message={errors.zipCode}/>
            </div>
            <div className="col-md-4">
              <label>Country</label>
              <input type="text" className="form-control" value="USA" readOnly disabled/>
            </div>
          </div>
          <div className="d-flex justify-content-end gap-2 mt-3">
            <button type="button" className="btn btn-primary rounded-pill px-4" disabled={saving} onClick={handleCancel}>Cancel</button>
            <button type="submit" className="btn btn-primary rounded-pill px-4" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>)}
      </Dialog>
    </div>);
};
export default PatientAddressInformation;
