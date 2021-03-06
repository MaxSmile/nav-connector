const { assert } = require('chai');

const { axios, technicalUser, softwareData } = require('./lib/globals.js');
const createInvoiceOperations = require('./lib/create-invoice-operations.js');
const createInvoiceModifyOperation = require('./lib/create-invoice-modify-operation.js');
const waitInvoiceProcessing = require('./lib/wait-invoice-processing.js');

const manageInvoice = require('../src/manage-invoice.js');
const queryInvoiceData = require('../src/query-invoice-data.js');

describe('queryInvoiceData()', () => {
  let existingInvoiceNumber;
  let modifiedInvoiceNumber;
  let transactionId;

  before(async function before() {
    /* Create invoice operations. */
    const invoiceCreateOperation = createInvoiceOperations({
      taxNumber: technicalUser.taxNumber,
      size: 2,
    });

    const invoiceOperations = {
      compressedContent: false,
      invoiceOperation: invoiceCreateOperation,
    };

    [existingInvoiceNumber, modifiedInvoiceNumber] = invoiceCreateOperation.map(
      operation =>
        Buffer.from(operation.invoiceData, 'base64')
          .toString()
          .match(/<invoiceNumber>(.*?)<\/invoiceNumber>/g)[0]
          .replace(/<\/?invoiceNumber>/g, '')
    );

    /* Wait for invoice operations to send and be processed. */
    transactionId = await manageInvoice({
      invoiceOperations,
      technicalUser,
      softwareData,
      axios,
    });

    await waitInvoiceProcessing({
      transactionId,
      technicalUser,
      softwareData,
      axios,
      test: this.test,
    });

    /* After invoices are processed create and send a modifier invoice. */
    const invoiceModifyOperation = createInvoiceModifyOperation({
      taxNumber: technicalUser.taxNumber,
      originalInvoiceNumber: modifiedInvoiceNumber,
    });

    const invoiceModifyOperations = {
      compressedContent: false,
      invoiceOperation: invoiceModifyOperation,
    };

    const invoiceModifyTransactionId = await manageInvoice({
      invoiceOperations: invoiceModifyOperations,
      technicalUser,
      softwareData,
      axios,
    });

    await waitInvoiceProcessing({
      transactionId: invoiceModifyTransactionId,
      technicalUser,
      softwareData,
      axios,
      test: this.test,
    });
  });

  it('should normalize invoiceQuery object key order', async () => {
    const invoiceQuery = {
      invoiceNumber: 'invoiceNumber',
      invoiceDirection: 'OUTBOUND',
    };

    await queryInvoiceData({
      invoiceQuery,
      technicalUser,
      softwareData,
      axios,
    });
  });

  it('should resolve without "invoiceDataResult" property when invoiceQuery query has no result', async () => {
    const invoiceQuery = {
      invoiceNumber: 'invoiceNumber',
      invoiceDirection: 'OUTBOUND',
    };

    const response = await queryInvoiceData({
      invoiceQuery,
      technicalUser,
      softwareData,
      axios,
    });

    assert.notProperty(response, 'invoiceDataResult');
  });

  it('should resolve with "invoiceData", "compressedContentIndicator" and "auditData" property when invoiceQuery query has result', async () => {
    const invoiceQuery = {
      invoiceNumber: existingInvoiceNumber,
      invoiceDirection: 'OUTBOUND',
    };

    const response = await queryInvoiceData({
      invoiceQuery,
      technicalUser,
      softwareData,
      axios,
    });

    assert.hasAllKeys(response, [
      'invoiceData',
      'compressedContentIndicator',
      'auditData',
    ]);
  });
});
