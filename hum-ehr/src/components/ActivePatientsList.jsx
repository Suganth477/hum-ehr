import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  DataGrid, 
  GridToolbar,
  GridActionsCellItem 
} from '@mui/x-data-grid';
import { 
  Box, 
  Badge, 
  Tabs, 
  Tab, 
  Chip,
  IconButton,
  Paper,
  Typography
} from '@mui/material';
import { 
  Close as CloseIcon,
  MoreVert as MoreVertIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import { APIUtility } from '../js/APIUtility';

const ActivePatientsList = ({ baseUrl, productCode }) => {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [paginationModel, setPaginationModel] = useState({
    page: 0,
    pageSize: 10,
  });
  const [rowCount, setRowCount] = useState(0);
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
  const [activePatientTabs, setActivePatientTabs] = useState([]);
  const navigate = useNavigate();

   const loadFilterInputsWithValue = async () => {
    try {
      const [programs, facilities, physicians, clinicians, userDetails] = [[],[],[],[],[]] /*await Promise.all([
       // utility.getListOfSubscribedProducts(),
        //utility.getListOfFacilities(),
        //utility.getListOfPhysiciansInCareGroup(),
        //utility.getListOfClinicians(),
        //utility.getLoginUserDetails()
      ]);*/
      
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
      //utility.failureMessage("Failed to fetch the filter input values. Please try again.");
    }
  };
  // Fetch patient data
  useEffect(() => {
  loadFilterInputsWithValue(); // ✅ Only once
}, []);

useEffect(() => {
  fetchPatients();
}, [filters, paginationModel]); // ✅ Separate effect for fetching

  

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
      const token = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0aW5nX2FwaHltYW5pa2FuZGFuIiwidGltZW91dFNjcmVlbiI6IiIsInRpbWV6b25lIjoiVVMvRWFzdGVybiIsImlzV2ViTG9naW4iOiJZIiwidGltZW91dER1cmF0aW9uIjo2MC4wLCJ1c2VySWQiOjk0NTE0LCJsb2dnZWRJbkNsaW5pY2lhbklkIjotMSwibG9nZ2VkSW5QaHlzaWNpYW5JZCI6MTQ1MSwiYXVkIjoid2ViIiwiY2xpbmljaWFuQWRtaW5GbGFnIjoiTiIsImF1ZGl0TG9nVVVJRCI6IjMzNGI1ZGY3LTU0MjEtNDYzYy1iYmEwLTMwYWM2M2MxMmRkYy0yMDI0LTAzLTA1LTA3LTA3LTEwIiwicGh5c2ljaWFuQWRtaW5GbGFnIjoiWSIsInJvbGVDb2RlIjoiQ01TUEhZU0lDSSIsImlzVGltZW91dCI6Ik4iLCJjbGluaWNpYW5TdXBlcnZpc29yRmxhZyI6Ik4iLCJleHAiOjE3NTI3NDgwNTgsImlhdCI6MTc1MjY2MTY1ODUyMSwianRpIjoiMTAxZjMyMmQtYjE0Ni00YWFlLWEyNjAtMDZiNmMzYzcwMTc5In0._NNqy9SKJmzyhzhb3mZO4bl8KsF7FGKl1GzRnptnz1M';
      const response = await fetch(APIUtility.API_END_POINT_URL.allActivePatientDetails, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token 
        },
        body: JSON.stringify({
          draw: 1,
          length: paginationModel.pageSize,
          start: paginationModel.page * paginationModel.pageSize,
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
        setRowCount(responseData.recordsFiltered);
        const formattedPatients = responseData.data.map((patient, index) => ({
          id: patient.patientId,
          sno: index + 1,
          fullName: patient.fullName,
          gender: patient.genderDesc,
          dob: patient.dob,
          phone: formatPhoneNumber(patient),
          emrId: patient.emrId,
          medicareNumber: patient.medicareNumber || '',
          patientData: patient // Store original data for actions
        }));
        setPatients(formattedPatients);
      }
    } catch (error) {
      console.error(error);
      // utility.failureMessage("Failed to fetch patients");
    } finally {
      setLoading(false);
    }
  };

  const formatPhoneNumber = (patient) => {
    const { mobilePhoneInvalidFlag, pagerPhoneInvalidFlag, workPhoneInvalidFlag, 
           mobilePhoneNumber, homePhoneNumber, workPhoneNumber } = patient;
    
    return (
      <Box>
        {mobilePhoneNumber && (
          <Typography 
            color={mobilePhoneInvalidFlag === "Y" ? 'error' : 'text.primary'}
            variant="body2"
          >
            {mobilePhoneNumber} (MPH)
          </Typography>
        )}
        {homePhoneNumber && (
          <Typography 
            color={pagerPhoneInvalidFlag === "Y" ? 'error' : 'text.primary'}
            variant="body2"
          >
            {homePhoneNumber} (HPH)
          </Typography>
        )}
        {workPhoneNumber && (
          <Typography 
            color={workPhoneInvalidFlag === "Y" ? 'error' : 'text.primary'}
            variant="body2"
          >
            {workPhoneNumber} (WPH)
          </Typography>
        )}
      </Box>
    );
  };

  const columns = [
    { 
      field: 'sno', 
      headerName: 'S.No', 
      width: 70,
      sortable: false,
      filterable: false
    },
    { 
      field: 'fullName', 
      headerName: 'Name', 
      width: 180,
      renderCell: (params) => (
        <Typography
          color="primary"
          sx={{ cursor: 'pointer' }}
          onClick={() => displayPatientNameInNewTab(params.row.id, params.row.fullName)}
        >
          {params.value}
        </Typography>
      )
    },
    { 
      field: 'gender', 
      headerName: 'Gender', 
      width: 100 
    },
    { 
      field: 'dob', 
      headerName: 'Date of Birth', 
      width: 120 
    },
    { 
      field: 'phone', 
      headerName: 'Phone Number', 
      width: 200,
      sortable: false,
      filterable: false
    },
    { 
      field: 'emrId', 
      headerName: 'EMR Id', 
      width: 120 
    },
    { 
      field: 'medicareNumber', 
      headerName: 'Medicare Number', 
      width: 150 
    },
    {
      field: 'actions',
      type: 'actions',
      headerName: 'Actions',
      width: 100,
      getActions: (params) => [
        <GridActionsCellItem
          icon={<PersonIcon />}
          label="View Profile"
          onClick={() => displayPatientNameInNewTab(params.id, params.row.fullName)}
          showInMenu
        />,
        <GridActionsCellItem
          icon={<MoreVertIcon />}
          label="More Actions"
          onClick={() => {}}
          showInMenu
        />
      ],
    }
  ];

  // Patient tab management functions (same as before)
  const loadPatientChartNameList = () => {
    // ... same implementation
  };

  const handlePatientTabClick = (patientId) => {
    // ... same implementation
  };

  const updatePatientLocalStorageInformation = (patientId) => {
    // ... same implementation
  };

  const closePatientChart = (patientId, e) => {
    // ... same implementation
  };

  const removePatientInformationFromLocalStorage = (patientId) => {
    // ... same implementation
  };

  const displayPatientNameInNewTab = (patientId, patientName) => {
    // ... same implementation
  };

  const handlePatientChartLocalStorageInformation = (patientId, patientName) => {
    // ... same implementation
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* Patient Tabs */}
      <Paper sx={{ mb: 2, p: 1 }}>
        <Tabs 
          value={activePatientTabs.find(tab => tab.isActive)?.id || 'patient_list'} 
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab 
            label={
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <span>Patient List</span>
                <Chip 
                  label={rowCount} 
                  size="small" 
                  sx={{ ml: 1 }} 
                />
              </Box>
            }
            value="patient_list"
            iconPosition="end"
            sx={{ minHeight: 48 }}
          />
          
          {activePatientTabs.filter(tab => tab.isMainTab).map(tab => (
            <Tab
              key={tab.id}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <span>{tab.name}</span>
                  <IconButton
                    size="small"
                    onClick={(e) => closePatientChart(tab.id, e)}
                    sx={{ ml: 0.5 }}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Box>
              }
              value={tab.id}
              iconPosition="end"
              sx={{ minHeight: 48 }}
            />
          ))}
          
          {activePatientTabs.filter(tab => !tab.isMainTab).length > 0 && (
            <Tab
              label={
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <span>More</span>
                  <Chip 
                    label={activePatientTabs.filter(tab => !tab.isMainTab).length} 
                    size="small" 
                    sx={{ ml: 1 }} 
                  />
                </Box>
              }
              value="more"
              iconPosition="end"
              sx={{ minHeight: 48 }}
            />
          )}
        </Tabs>
      </Paper>

      {/* Patient List */}
      <Paper sx={{ height: 600, p: 1 }}>
        <DataGrid
          rows={patients}
          columns={columns}
          loading={loading}
          rowCount={rowCount}
          pageSizeOptions={[5, 10, 25]}
          paginationModel={paginationModel}
          paginationMode="server"
          onPaginationModelChange={setPaginationModel}
          slots={{
            toolbar: GridToolbar,
          }}
          slotProps={{
            toolbar: {
              showQuickFilter: true,
              quickFilterProps: { debounceMs: 500 },
            },
          }}
          sx={{ 
            border: 0,
            '& .MuiDataGrid-cell:focus': {
              outline: 'none'
            }
          }}
        />
      </Paper>

      {/* Patient Chart Containers */}
      {activePatientTabs.map(tab => (
        <Box 
          key={tab.id} 
          sx={{ 
            display: tab.isActive ? 'block' : 'none',
            mt: 2
          }}
        >
          <Paper sx={{ p: 2, height: 600 }}>
            <Typography variant="h6">Patient Chart for {tab.name}</Typography>
            {/* PatientChart component would go here */}
          </Paper>
        </Box>
      ))}
    </Box>
  );
};

export default ActivePatientsList;