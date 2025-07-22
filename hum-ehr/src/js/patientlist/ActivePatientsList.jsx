import { useState, useEffect } from 'react';
import { 
  DataTable, 
  Column, 
  TabView, 
  TabPanel,
  Chip,
  Button,
  InputText,
  Dropdown,
  Calendar,
  Badge,
  Tooltip
} from 'primereact';
import { 
  Avatar,
  Card
} from 'primereact';

import env from '../../env';

const ActivePatientsList = () => {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [first, setFirst] = useState(0);
  const [rows, setRows] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);
  const [filters, setFilters] = useState({
    productCode: '',
    facilityId: '',
    physicianId: '',
    clinicianId: '',
    clinicianRoleStatus: 'ALL',
    physicianRoleStatus: 'ALL',
    fromDate: '',
    toDate: '',
    programStatus: 'ALL',
    search: '',
    searchColumn: 'PATIENNAME'
  });

  const loadFilterInputsWithValue = async () => {
    try {
      const [programs, facilities, physicians, clinicians] = [[],[],[],[],[]];
      
      setFilters(prev => ({
        ...prev,
        productOptions: constructSubscribedProblemList(programs),
        facilityOptions: facilities,
        physicianOptions: physicians,
        clinicianOptions: clinicians
      }));
      
      window.history.replaceState(null, null, "?nav=");
      loadPatientChartNameList();
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    loadFilterInputsWithValue();
  }, []);

  useEffect(() => {
    fetchPatients();
  }, [filters, first, rows]);

  const constructSubscribedProblemList = (programList) => {
    return programList.reduce((prevProgram, nextProgram) => {
      return [...prevProgram, 
        { value: nextProgram.code, label: nextProgram.name }
      ];
    }, [{ value: '', label: 'All' }]);
  };

  const fetchPatients = async () => {
    setLoading(true);
    try {
      const token = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0aW5nX3N1cHJpeWFhIiwidGltZW91dFNjcmVlbiI6IiIsInRpbWV6b25lIjoiVVMvRWFzdGVybiIsImlzV2ViTG9naW4iOiJZIiwidGltZW91dER1cmF0aW9uIjo2MC4wLCJ1c2VySWQiOjMzNjg5LCJsb2dnZWRJbkNsaW5pY2lhbklkIjotMSwibG9nZ2VkSW5QaHlzaWNpYW5JZCI6LTEsImF1ZCI6IndlYiIsImNsaW5pY2lhbkFkbWluRmxhZyI6IlkiLCJhdWRpdExvZ1VVSUQiOiIxZDJhM2Q3Ni05YmRiLTRiYTEtOWNiYS03M2Q5ZmI3NGVjMTgtMjAyNC0wNC0wOC0xOS00MS0yMSIsInBoeXNpY2lhbkFkbWluRmxhZyI6Ik4iLCJyb2xlQ29kZSI6IkNNU0NMSU5JQ0kiLCJpc1RpbWVvdXQiOiJOIiwiY2xpbmljaWFuU3VwZXJ2aXNvckZsYWciOiJZIiwiZXhwIjoxNzUzMTg1NzU0LCJpYXQiOjE3NTMwOTkzNTQ5NzksImp0aSI6IjZkMDRjOTQ4LWM1NTgtNGQxNS05NDk4LTBjMzE3YzFlYTMyNyJ9.UkbUAqvGy5piola2LZ1mDI70gkB4LHmCEyZ_pvWCNXM';
      const response = await fetch(`${env.BASE_URL}/patient/list/all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token 
        },
        body: JSON.stringify({
          draw: 1,
          length: rows,
          start: first,
          filter: {
            productCode: filters.productCode || "",
            facilityId: filters.facilityId,
            physicianId: filters.physicianId,
            clinicianId: filters.clinicianId,
            clinicianRoleStatus: filters.clinicianRoleStatus || "ALL",
            physicianRoleStatus: filters.physicianRoleStatus || "ALL",
            fromDate: filters.fromDate,
            toDate: filters.toDate,
            programStatus: filters.programStatus,
          },
          order: {
            column: 'fullName',
            type: 'asc'
          },
          search: filters.search,
          searchColumn: filters.searchColumn
        })
      });
      
      const responseData = await response.json();
      if (responseData.status === "success") {
        setTotalRecords(responseData.recordsFiltered);
        const formattedPatients = responseData.data.map((patient, index) => ({
          id: patient.patientId,
          sno: index + 1,
          fullName: patient.fullName,
          gender: patient.genderDesc,
          dob: patient.dob,
          phone: formatPhoneNumber(patient),
          emrId: patient.emrId,
          medicareNumber: patient.medicareNumber || '',
          patientData: patient
        }));
        setPatients(formattedPatients);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const formatPhoneNumber = (patient) => {
    const { mobilePhoneInvalidFlag, pagerPhoneInvalidFlag, workPhoneInvalidFlag, 
           mobilePhoneNumber, homePhoneNumber, workPhoneNumber } = patient;
    
    return (
      <div className="flex flex-column">
        {mobilePhoneNumber && (
          <span className={mobilePhoneInvalidFlag === "Y" ? 'text-red-500' : ''}>
            {mobilePhoneNumber} (MPH)
          </span>
        )}
        {homePhoneNumber && (
          <span className={pagerPhoneInvalidFlag === "Y" ? 'text-red-500' : ''}>
            {homePhoneNumber} (HPH)
          </span>
        )}
        {workPhoneNumber && (
          <span className={workPhoneInvalidFlag === "Y" ? 'text-red-500' : ''}>
            {workPhoneNumber} (WPH)
          </span>
        )}
      </div>
    );
  };

  const actionBodyTemplate = (rowData) => {
    return (
      <button
        type="button"
        className="action-group-icon btn btn-default"
        onClick={() => displayPatientProfile(rowData.id, rowData.fullName)}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', borderRadius: '50%' }}
        title="View Actions"
      >
        <span className="mdi mdi-dots-vertical" style={{ fontSize: 30, color: '--app-color2' }}></span>
      </button>
    );
  };

  const nameBodyTemplate = (rowData) => {
    return (
      <Button 
        label={rowData.fullName} 
        className="p-button-text p-button-plain" 
        onClick={() => displayPatientNameInNewTab(rowData.id, rowData.fullName)}
        style={{ color: '#286090' }}
      />
    );
  };

  const loadPatientChartNameList = () => {
    // Implementation remains the same
  };

  const handlePatientTabClick = (patientId) => {
    // Implementation remains the same
  };

  const closePatientChart = (patientId, e) => {
    e.stopPropagation();
  };

  const displayPatientNameInNewTab = (patientId, patientName) => {
    // Implementation remains the same
  };

  const onPage = (event) => {
    setFirst(event.first);
    setRows(event.rows);
  };

  return (
    <div className="w-full">
      <Card>
        <DataTable
          value={patients}
          lazy
          paginator
          first={first}
          rows={rows}
          totalRecords={totalRecords}
          onPage={onPage}
          loading={loading}
          rowsPerPageOptions={[5, 10, 25]}
          paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
          currentPageReportTemplate="Showing {first} to {last} of {totalRecords} patients"
          emptyMessage="No patients found."
          scrollable
          scrollHeight="flex"
          className="p-datatable-striped"
        >
          <Column field="sno" header="S.No" style={{ width: '70px' }} />
          <Column field="fullName" header="Name" style={{ width: '180px' }} />
          <Column field="gender" header="Gender" style={{ width: '100px' }} />
          <Column field="dob" header="Date of Birth" style={{ width: '120px' }} />
          <Column field="phone" header="Phone Number" style={{ width: '200px' }} />
          <Column field="emrId" header="EMR Id" style={{ width: '120px' }} />
          <Column field="medicareNumber" header="Medicare Number" style={{ width: '150px' }} />
          <Column body={actionBodyTemplate} header="Actions" style={{ width: '100px' }} />
        </DataTable>
      </Card>
    </div>
  );
};

export default ActivePatientsList;