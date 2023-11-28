import ReverseString from "./utils/ReverseString.js"
import Split2Chr from "./utils/Split2Chr.js";
import String2Hex from "./utils/String2Hex.js";
import mySqlDate from "./utils/Tanggal.js";
import db from "./config/database.js";
import { Sequelize, Op, QueryTypes, Model } from "sequelize";

let IpAddress = process.argv[2] // 192.168.7.101
let StationNO = process.argv[3] // 1
let PortNo = process.argv[4] // 502


// let IpAddress = '192.168.7.101'
// let StationNO = 1
let StationName = 'ST' + StationNO
let onVerificationBarcode = false
let onSubmitData = false

try {
    await db.authenticate();
} catch (error) {
    console.log('error:', error)
}

let registerAddress: {
    "BARCODE": 100,
    "COUNTER": 10,
    "ACTUAL": 531,
    "RESULT": 541,
    "FINAL_RESULT": 135,
    "TIME_RUNNING": 130,
    "PING_RESULT": 142,
    "BARCODE_CHECK": 140,
    "VERIFIKASI_BARCODE": 141,
    "INTERVAL_JOBDESC": 10,
    "JOB_ID": 411,
    "JOB_QTY": 421,
    "JOB_DESC": 431,
    "JOB_DESC1": 431,
    "JOB_DESC2": 441,
    "JOB_DESC3": 451,
    "JOB_DESC4": 461,
    "JOB_DESC5": 471,
    "JOB_DESC6": 481,
    "JOB_DESC7": 491,
    "JOB_DESC8": 501,
    "JOB_DESC9": 511,
    "JOB_DESC10": 521,
    "GLOBAL_TIME_SETTING": 551,
    "BARCODE_TYPE": 552,
    "STATION_NO": 560,
    "TRIGGER_SAVE": 137,
    "STATION_INTERVAL": 701,
    "STATION_NG_INPUT": 810,
    "STATION_NG_CONFIRM": 812
}

// let barcode = 'JM91E1334665' // NG
// let barcode = 'XXXXE1809791'
let barcode = 'JM91E1811112'
let transactionNumber

if (onVerificationBarcode === false) {
    onVerificationBarcode = true
    let __continues = ""


    // Verification Barcode Type
    let barcodeType = await handleBarcodeType(barcode)
    if (barcodeType.length > 0) {
        console.log("barcodeType:", barcodeType[0].description)
    } else {
        onVerificationBarcode = false
        console.log('barcode type not found...!!!!')
        __continues = 'BARCODE_TYPE_NG'
    }

    if (__continues === "") {
        // Verification Barcode Position
        let barcodePosition = await handleBarcodePos(barcode)
        if (barcodePosition !== null) {
            console.log("barcodePosition:", barcodePosition)
        }
    }

    let barcodeNGPos = null
    if (__continues === "") {
        // Verification Barcode NG State
        let barcodeNGData = await handleNGBarcodeCheck(barcode)
        if (barcodeNGData.length > 0) {
            barcodeNGPos = barcodeNGData[0].StationNO
            onVerificationBarcode = false
            console.log(`By Pass NG Barcode JOB Order, NG Station# ${barcodeNGPos}`)
            __continues = 'BARCODE_NG_STATION'
        }
    }

    if (__continues === "" && barcodeNGPos === null) {
        if (parseInt(barcodePosition) >= parseInt(StationNO)) {
            onVerificationBarcode = false
            console.log(`By Pass JOB Order, Current Station # ${barcodePosition}`)
            __continues = 'BARCODE_BYPASS_STATION'
        } else {
            if (parseInt(barcodePosition) !== (parseInt(StationNO) - 1)) {
                onVerificationBarcode = false
                console.log(`Error Interlock, Current Station# ${StationNo} Last Barcode Station# ${barcodePosition}`)
                __continues = 'INTERLOCK_ERROR'
            }
        }
    }

    if (__continues === "") {
        let dataJobs = await getJobList(IpAddress, barcode)

        if (dataJobs.length > 0) {
            var date = new Date();
            var components = [
                date.getYear(),
                date.getMonth(),
                date.getDate(),
                date.getHours(),
                date.getSeconds(),
                date.getUTCMilliseconds()
            ];
            transactionNumber = StationName + "-" + components.join("");
            console.log('remove data existing on stationpro table')
            let deleteOldStationPro = await db.query(`DELETE FROM tblStationPro WHERE StationIP = '${IpAddress}' AND StationBarcode = '${barcode}'`)
            let _isNow = new Date().toLocaleString("sv-SE", {
                timeZone: "Asia/Jakarta",
                format: "yyyy-MM-dd HH:mm:ss",
            })

            for (var i = 0; i < dataJobs.length; i++) {
                let _tanggal = _isNow.substring(0, 10)
                let _job_clientip = dataJobs[i].job_clientip
                let _job_id = dataJobs[i].job_id
                let _plc_input = dataJobs[i].plc_input
                let _job_description = dataJobs[i].job_description
                let _job_qty = dataJobs[i].job_qty
                const savedata = await db.query(`INSERT INTO tbltransaction_temp(Station_IP, BarcodeID1, TranNo, TranDate, JobId, JobTypeID, JobName, JobQtyProses, StartTime) VALUES('${IpAddress}','${barcode}', '${transactionNumber}', '${_tanggal}', '${_job_id}', '${_plc_input}', '${_job_description}', ${_job_qty},'${_isNow}')`)
            }
            console.log('create new data stationpro table')
            let saveStationPro = await db.query(`INSERT INTO tblStationPro(StationIP,StationNo,StationBarcode,StationBarType,StationTranNo,StationDate) VALUES('${IpAddress}',${StationNO},'${barcode}',fnc_bartype(fnc_barparam('${barcode}')),'${transactionNumber}','${_isNow}')`)
            console.log("records:", dataJobs.length)
        } else {
            __continues = 'BARCODE_JOB_NOT_FOUND'
        }
    }
    onVerificationBarcode = false
    console.log(`Status Process : ${__continues}`)
}

let savedetailjob = await handleSaveDetailJob(transactionNumber)
let savefinaldata = await handleSaveFinalData(transactionNumber)
console.log("-selesai-")

process.exit(1)

async function handleUpdateActualJobs(_transactionNo, _jobtype, jobid, _status, _value) {
    let sqlQuery
    if (_status === 'QTY') {
        sqlQuery = `UPDATE tbltransaction_temp SET ActualProcess = ${_value} `
    } else {
        let stsVal = _value === 1 ? 'OK' : 'NG'
        sqlQuery = `UPDATE tbltransaction_temp SET StatusProcess = '${stsVal}' `
    }
    sqlQuery = sqlQuery + ` WHERE TranNo = '${_transactionNo}' AND JobId = '${jobid}' AND JobTypeID = ${_jobtype}`
    try {
        let updatedetail = await db.query(sqlQuery)
    } catch (error) {
        console.log(`Error on update job detail ${error}`)
    }
}

async function handleSaveDetailJob(_transactionNo) {
    try {
        let tempdatarecords = await db.query(`SELECT * FROM tbltransaction_temp WHERE TranNo = '${_transactionNo}'`, {
            nest: true,
            QueryTypes: QueryTypes.SELECT
        })
        let _isNow = new Date().toLocaleString("sv-SE", {
            timeZone: "Asia/Jakarta",
            format: "yyyy-MM-dd HH:mm:ss",
        })
        if (tempdatarecords.length > 0) {
            for (var i = 0; i < tempdatarecords.length; i++) {
                let _tanggal = tempdatarecords[i].TranDate
                let _job_clientip = tempdatarecords[i].Station_IP
                let _job_barcode = tempdatarecords[i].BarcodeID1
                let _job_id = tempdatarecords[i].JobId
                let _plc_input = tempdatarecords[i].JobTypeID
                let _job_description = tempdatarecords[i].JobName
                let _job_qty = tempdatarecords[i].JobQtyProses
                let _job_result = tempdatarecords[i].StatusProcess
                let _job_StartTime = mySqlDate(tempdatarecords[i].StartTime)
                let _job_qtyActual = tempdatarecords[i].ActualProcess
                let _qresult = _job_result === null ? 'OK' : 'NG'
                const savedata = await db.query(`INSERT INTO tbltransaction(Station_IP, BarcodeID1, TranNo, TranDate, JobId, JobTypeID, JobName, JobQtyProses, StartTime, ActualProcess, StatusProcess, FinishTime)                 
                VALUES('${IpAddress}','${barcode}', '${transactionNumber}', '${_tanggal}', '${_job_id}', '${_plc_input}', '${_job_description}', ${_job_qty},'${_job_StartTime}',${_job_qtyActual},'${_qresult}', '${_isNow}' )`)
            }
            let removetemp = await db.query(`DELETE FROM tbltransaction_temp WHERE TranNo = '${_transactionNo}'`)
        }
    } catch (error) {
        console.log(`error save detail job ${error}`)
    }
}

async function handleSaveFinalData(_transactionNo, _finalResult, _IpAddress, _StationNo) {
    // _finalResult = 1 -> OK  2 -> NG
    // Trigger Calling on table tblstationpro (after update)
    let _statusProcess = _finalResult === 1 ? 'OK' : 'NG'
    try {
        let strQuery = `UPDATE tblstationpro SET StationResult = '${_statusProcess}' WHERE StationTranNo = '${_transactionNo}'`
        let savedata = await db.query(strQuery)
    } catch (error) {
        console.log(error)
    }
}

async function getJobList(_ip, _barcode) {
    try {
        let sqlQuery = `SELECT job_clientip,NOW(),job_id,plc_input,job_description,job_qty FROM v_clientjob WHERE job_clientip = '${_ip}' AND job_bartype = fnc_bartype(fnc_barparam('${_barcode}')) ORDER BY job_seqno`
        // let sqlQuery = `SELECT job_clientip,_BarcodeNO,_TranNO,NOW(),job_id,plc_input,job_description,job_qty FROM v_clientjob WHERE job_clientip = '${_ip}' AND job_bartype = fnc_bartype(fnc_barparam('${_barcode}')) ORDER BY job_seqno`
        const data = await db.query(sqlQuery, {
            type: QueryTypes.SELECT,
            nest: true
        })
        return data
    } catch (error) {
        console.log(`Error Query Barcode JOB List ${error}`)
        return null
    }
}

async function handleNGBarcodeCheck(_barcode) {
    try {
        let sqlQuery = `SELECT * FROM tblbarcodeng WHERE BarcodeNG = '${_barcode}' AND ValidUpdate = 0`
        const data = await db.query(sqlQuery, {
            type: QueryTypes.SELECT,
            nest: true
        })
        return data
    } catch (error) {
        console.log(`Error Query Barcode NG ${error}`)
        return null
    }
}

function handleStatePos(_nPos) {
    return _nPos >= 1 ? 1 : 0
}

async function handleBarcodePos(_barcode) {
    let lastPos = null
    try {
        let sqlQuery = `SELECT * FROM tblBarcodelog WHERE BarcodeID1 = '${_barcode}'`
        const data = await db.query(sqlQuery, {
            type: QueryTypes.SELECT,
            nest: true
        })
        if (data.length > 0) {
            // 0 none state
            // 1 OK state
            // 2 NG state
            // 3 By Pass state
            let Pos1 = data[0].Pos1
            let Pos2 = data[0].Pos2
            let Pos3 = data[0].Pos3
            let Pos4 = data[0].Pos4
            let Pos5 = data[0].Pos5
            let Pos6 = data[0].Pos6
            let Pos7 = data[0].Pos7
            let Pos8 = data[0].Pos8
            let Pos9 = data[0].Pos9
            lastPos = handleStatePos(Pos1) + handleStatePos(Pos2) + handleStatePos(Pos3) + handleStatePos(Pos4) + handleStatePos(Pos5) + handleStatePos(Pos6) + handleStatePos(Pos7) + handleStatePos(Pos8) + handleStatePos(Pos9)
        } else {
            if (parseInt(StationNO) === 1) {
                let insertBarcodeLog = await db.query(`INSERT INTO tblbarcodelog(BarcodeID1) VALUES('${_barcode}')`)
            }
            lastPos = 0
        }
    } catch (error) {
        console.log(`Error Query Barcode Position ${error}`)
    }
    return lastPos
}

async function handleBarcodeType(_barcode) {
    let sqlQuery = `SELECT description FROM tblbarcodetype WHERE barcode_type = fnc_barparam('${_barcode}')`
    try {
        const data = await db.query(sqlQuery, {
            type: QueryTypes.SELECT,
            nest: true
        })
        return data
    } catch (error) {
        console.log(`error query barcode type ${error} `)
        return null
    }
}

async function CariKirimTypeBarcode() {
    let dataValue = "K241A"
    console.log("Barcode Type : " + dataValue);
    for (var i = 0; i <= dataValue.length - 1; i++) {
        // let alamat2 = parseInt(JobTypeRegister + i);
        console.log("i:", i)
        let kata = ReverseString(Split2Chr(dataValue, i))
        if (kata.length > 0) {
            console.log("kata:", kata)
            let q = String2Hex(kata);
            console.log(q)
            console.log(parseInt(q, 16))
        }
        // if (TR(dataValue, i) != "") {
        //     var hasil = reverseString(TR(dataValue, i));
        //     var hasil2 = stringToHex(hasil);
        //     var hasil3 = parseInt(hasil2, 16);
        //     client.writeSingleRegister(alamat2, parseInt(hasil3), 0)
        //         .then(function (resp) { }).catch(function () {
        //             console.error(arguments)
        //         })
        // }
    }
}