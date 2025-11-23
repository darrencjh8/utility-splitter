/* eslint-disable no-unused-vars */
const Service = require('./Service');
const fs = require('fs');
const path = require('path');
const AsyncLock = require('async-lock');

const lock = new AsyncLock();
const DATA_DIR = path.join(__dirname, '../data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const getTenantDir = (tenantId) => {
  const dir = path.join(DATA_DIR, tenantId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
};

const getTenantFile = (tenantId) => path.join(getTenantDir(tenantId), 'tenant.json');
const getTenantDataFile = (tenantId, year) => {
  const filename = year ? `data_${year}.json` : 'data.json';
  return path.join(getTenantDir(tenantId), filename);
};

/**
* Get tenant data
*
* tenantId String Tenant ID
* year Integer Optional year filter (optional)
* returns Object
* */
const tenantDataGET = ({ tenantId, year }) => new Promise(
  async (resolve, reject) => {
    try {
      const filePath = getTenantDataFile(tenantId, year);
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        resolve(Service.successResponse(JSON.parse(data)));
      } else {
        resolve(Service.successResponse({}));
      }
    } catch (e) {
      reject(Service.rejectResponse(
        e.message || 'Invalid input',
        e.status || 500,
      ));
    }
  },
);

/**
* Update tenant data
*
* body Object 
* tenantId String Tenant ID
* year Integer Optional year filter (optional)
* no response value expected for this operation
* */
const tenantDataPUT = ({ body, tenantId, year }) => new Promise(
  async (resolve, reject) => {
    lock.acquire(tenantId, () => {
      try {
        const filePath = getTenantDataFile(tenantId, year);
        fs.writeFileSync(filePath, JSON.stringify(body, null, 2));
        resolve(Service.successResponse(body));
      } catch (e) {
        reject(Service.rejectResponse(
          e.message || 'Invalid input',
          e.status || 500,
        ));
      }
    });
  },
);

/**
* Get tenant details
*
* tenantId String Tenant ID
* returns _tenant_get_200_response
* */
const tenantGET = ({ tenantId }) => new Promise(
  async (resolve, reject) => {
    try {
      const filePath = getTenantFile(tenantId);
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        resolve(Service.successResponse(JSON.parse(data)));
      } else {
        // Return default or empty if not found, or 404?
        // For now, return empty object or basic structure
        resolve(Service.successResponse({ id: tenantId }));
      }
    } catch (e) {
      reject(Service.rejectResponse(
        e.message || 'Invalid input',
        e.status || 500,
      ));
    }
  },
);

/**
* Update tenant details
*
* tenantId String Tenant ID
* tenantPutRequest TenantPutRequest 
* no response value expected for this operation
* */
const tenantPUT = ({ tenantId, tenantPutRequest }) => new Promise(
  async (resolve, reject) => {
    lock.acquire(tenantId, () => {
      try {
        const filePath = getTenantFile(tenantId);
        const data = { ...tenantPutRequest, id: tenantId };
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        resolve(Service.successResponse(data));
      } catch (e) {
        reject(Service.rejectResponse(
          e.message || 'Invalid input',
          e.status || 500,
        ));
      }
    });
  },
);

module.exports = {
  tenantDataGET,
  tenantDataPUT,
  tenantGET,
  tenantPUT,
};
