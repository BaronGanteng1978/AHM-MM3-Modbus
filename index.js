// Default command line 
// node index.js 192.168.7.101 1 502
// node index.js IP-AddressPLC StationNo Port-PLC
// Work Station 1-9
// Wotk Station 10 -> Repair station
let IpAddress = process.argv[2] // 192.168.7.101
let StationNO = process.argv[3] // 1
let PortNo = process.argv[4] // 502
let StationName = 'ST-' + StationNO.toString()
import Modbus from 'jsmodbus'
import net from 'net'
import dotEnv from 'dotenv'
import db from './config/database.js'
import ReverseBarcode from './utils/ReverseBarcode.js'
import { Sequelize, Op, QueryTypes, Model } from "sequelize";
import ReverseString from "./utils/ReverseString.js"
import Split2Chr from "./utils/Split2Chr.js";
import String2Hex from "./utils/String2Hex.js";
import mySqlDate from "./utils/Tanggal.js";
import Hex2Ascii from './utils/Hex2Ascii.js'

dotEnv.config()

let D0 = 4096;
let D600_Old = 0
let D100_Old = 0
let D135_Old = 0
let D137_Old = 0
let D140_Old = 0
let D812_Old = 0
let D431_Old = []
let D441_Old = []
let successCount = 0
let counterHeartBit = 0
let errorCount = 0
let reconnectCount = 0
let closedOnPurpose = false
let plcStateConnected = true

const socket = new net.Socket()
const client = new Modbus.client.TCP(socket, 1)
const options = {
    host: IpAddress,
    port: parseInt(PortNo),
    'autoReconnect': false,
    'logEnabled': true
}

let firstTime = true
let onVerificationBarcode = false
let onSubmitData = false
let transactionNumber

try {
    await db.authenticate();
} catch (error) {
    console.log('error:', error)
}

async function CheckByPassStation(_StationNo) {
    let _tanggal = new Date().toLocaleString("sv-SE", {
        timeZone: "Asia/Jakarta",
        format: "yyyy-MM-dd HH:mm:ss",
    })
    let strQuery = `SELECT * FROM tblbypass WHERE CAST('${_tanggal}' AS datetime) BETWEEN StartDate AND EndDate `

    if (_StationNo !== undefined) {
        strQuery = strQuery + ` AND StationNo = ${_StationNo} `
    }
    strQuery = strQuery + ` ORDER BY StationNo ASC`
    const ByPass = await db.query(strQuery, {
        type: QueryTypes.SELECT,
        nest: true
    })
    return ByPass
}

let ByPassState = await CheckByPassStation()
console.log("ByPassState:", ByPassState)

let ByPassStateNo = await CheckByPassStation(parseInt(StationNO))

let __ByPass = false

if (ByPassStateNo.length > 0) {
    console.log("ByPassStateNo:", ByPassStateNo[0].StationNo)
    __ByPass = parseInt(ByPassStateNo[0].StationNo) === parseInt(StationNO) ? true : false
}

console.log("__ByPass:", __ByPass)

let errorBarcode = {
    "Error_TypeEnggineNotFound": 3,
    "Error_ByPassNGBarcode": 2,
    "Error_BarcodeCompleted": 9,
    "Error_BarcodeNotFromST1": 4,
    "Error_ByPassBarcode": 5,
    "Error_BarcodeNotSequence": 6,
    "Error_BarcodeNGNotFound": 7
}

let registerAddress = {
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
    "STATION_NG_CONFIRM": 812,
    "STATION_NG_BARCODETYPE": 820,
    "STATION_NG_POS": 830,
    "TimerProcess": 20
}

// PLC Station Number
var objD560 = {
    value: null,
    Validation() {
        let nilai = this.value
        console.log(`D560: ${nilai}`)
    },
    get nilai() {
        return this.value
    },
    set nilai(value) {
        this.value = value
        this.Validation()
    },

}

// Heartbit Register Address
var objD600 = {
    value: null,
    Validation() {
        if (D600_Old !== this.value) {
            D600_Old = this.value
            counterHeartBit = counterHeartBit + 1
        }
    },
    get nilai() {
        return this.value
    },
    set nilai(value) {
        this.value = value
        this.Validation()
    },
}

var objD431 = {
    value: null,
    Validation() {
        if (D431_Old !== this.value) {
            D431_Old = this.value
            let data = this.value
            let _String = ""
            for (var i = 0; i <= 10; i++) {
                if (data[i] !== undefined) {
                    let _str = Hex2Ascii(data[i]);
                    _String = _String + ReverseString(_str)
                }
            }
            console.log("Nama Job#1:", _String)
        }
    },
    get nilai() {
        return this.value
    },
    set nilai(value) {
        this.value = value
        this.Validation()
    },
}

var objD441 = {
    value: null,
    Validation() {
        if (D441_Old !== this.value) {
            D441_Old = this.value
            let data = this.value
            let _String = ""
            for (var i = 0; i <= 10; i++) {
                if (data[i] !== undefined) {
                    let _str = Hex2Ascii(data[i]);
                    _String = _String + ReverseString(_str)
                }
            }
            console.log("Nama Job#2:", _String)
        }
    },
    get nilai() {
        return this.value
    },
    set nilai(value) {
        this.value = value
        this.Validation()
    },
}

// State NG Barcode Repair Goto Station - STATION_NG_INPUT : 810
var objD810 = {
    value: null,
    async Validation() {
        let data = this.value
    },
    get nilai() {
        return this.value
    },
    set nilai(value) {
        let __nilai = value
        this.value = __nilai
        this.Validation()
    },
}

// State NG Pos Repair Station - STATION_NG_POS : 830
var objD830 = {
    value: null,
    async Validation() {
        let data = this.value
    },
    get nilai() {
        return this.value
    },
    set nilai(value) {
        let __nilai = value
        this.value = __nilai
        this.Validation()
    },
}

// State Barcode Check - BARCODE_CHECK": 140,
var objD140 = {
    value: null,
    async Validation() {
        if (D140_Old !== this.value) {
            D140_Old = parseInt(this.value)
            if (parseInt(this.value) === 1) {
                console.log(`State Check Barcode Value`)
                let _nilai = objD100.nilai
                if (_nilai.length > 0) {
                    console.log(`Verfication Barcode#: ${_nilai}`)
                    if (onVerificationBarcode === false) {
                        if (parseInt(StationNO === 10)) {
                            // Repair Station
                            handleBarcodeRepair(_nilai)
                        } else {
                            // Workstation 1 - 9
                            handleBarcodeVerification(_nilai)
                        }
                    }
                }
            }
        }
    },
    get nilai() {
        return this.value
    },
    set nilai(value) {
        this.value = value
        this.Validation()
    },
}

// Barcode Register Address
var objD100 = {
    value: null,
    async Validation() {
        if (D100_Old !== this.value) {
            D100_Old = this.value
            // let _nilai = this.nilai
            // if (_nilai.length > 0) {
            //     console.log(`Verfication Barcode#: ${_nilai}`)
            //     if (onVerificationBarcode === false) {
            //         handleBarcodeVerification(_nilai)
            //     }
            // }
        }
    },
    get nilai() {
        return this.value
    },
    set nilai(value) {
        let __nilaiBarcode = ReverseBarcode(value)
        this.value = __nilaiBarcode
        this.Validation()
    },
}

// Actual QTY PLC Job Item Qty - 531
var objD531 = {
    value: null,
    async Validation() {
        let data = this.value
        // for (var i = 0; i < 10; i++) {
        //     let _nQty = parseInt(data[i])
        //     console.log(`Job Qty ${i + 1} : ${_nQty}`)
        // }
    },
    get nilai() {
        return this.value
    },
    set nilai(value) {
        let __nilai = value
        this.value = __nilai
        this.Validation()
    },
}

// Result PLC Job Item - 541
var objD541 = {
    value: null,
    async Validation() {
        let data = this.value
        // for (var i = 0; i < 10; i++) {
        //     let _nResult = parseInt(data[i])
        //     let _Result = "-"
        //     if (_nResult > 0) {
        //         _Result = _nResult === 1 ? 'OK' : 'NG'
        //     }
        //     console.log(`Result Qty ${i + 1} Result : ${_Result}`)
        // }
    },
    get nilai() {
        return this.value
    },
    set nilai(value) {
        let __nilai = value
        this.value = __nilai
        this.Validation()
    },
}

// Final Result Station
var objD135 = {
    value: null,
    async Validation() {
        let data = parseInt(this.value)
        if (data !== D135_Old) {
            D135_Old = data
            let _cResult = ""
            if (data > 0) {
                _cResult = parseInt(data) === 1 ? 'OK' : 'NG'
                console.log(`Final Result Station #${StationNO} : ${_cResult}`)
            }
        }
    },
    get nilai() {
        return this.value
    },
    set nilai(value) {
        let __nilai = value
        this.value = __nilai
        this.Validation()
    },
}

// Trigger Save Data From PLC - 137
var objD137 = {
    value: null,
    async Validation() {
        let data = this.value
        if (D137_Old !== data) {
            D137_Old = data
            if (parseInt(data) !== 0) {
                if (onSubmitData === false) {
                    console.log(`Save Data Station #${StationNO}`)
                    onSubmitData = true
                    let savedetailjob = await handleSaveDetailJob(transactionNumber)
                    let savefinaldata = await handleSaveFinalData(transactionNumber)
                    console.log(`Save Data Station #${StationNO} Completed`)
                    onSubmitData = false
                }
            }
        }
    },
    get nilai() {
        return this.value
    },
    set nilai(value) {
        let __nilai = value
        this.value = __nilai
        this.Validation()
    },
}

// Trigger Save Repair Station - STATION_NG_CONFIRM : 812
var objD812 = {
    value: null,
    async Validation() {
        let data = this.value
        if (D812_Old !== data) {
            D812_Old = data
            if (parseInt(data) !== 0) {
                if (onSubmitData === false) {
                    let _barcode = D100_Old
                    let _repair_goto = parseInt(objD810.nilai)
                    let _ng_pos = parseInt(objD830.nilai)
                    console.log(`Save Data Repair Station`)
                    onSubmitData = true
                    let saverepair = await handleSaveRepair(_barcode, _repair_goto, _ng_pos)
                    console.log(`Save Data Repair Station  Completed`)
                    onSubmitData = false
                }
            }
        }
    },
    get nilai() {
        return this.value
    },
    set nilai(value) {
        let __nilai = value
        this.value = __nilai
        this.Validation()
    },
}

function Div2Chr(_string) {
    const result = _string.match(/.{1,2}/g)
    return result
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
            if (ByPassState.length > 0) {
                for (var i = 0; i < ByPassState.length; i++) {
                    let _StByPass = parseInt(ByPassState[i].StationNo)
                    if (parseInt(data[_StByPass]) === 0) {
                        if (_StByPass < parseInt(StationNO)) {
                            let strUpdate = `UPDATE tblbarcodelog SET `
                            switch (_StByPass) {
                                case 1:
                                    Pos1 = 3
                                    strUpdate = strUpdate + ` Pos1 = 3 `
                                    break
                                case 2:
                                    Pos2 = 3
                                    strUpdate = strUpdate + ` Pos2 = 3 `
                                    break
                                case 3:
                                    Pos3 = 3
                                    strUpdate = strUpdate + ` Pos3 = 3 `
                                    break
                                case 4:
                                    Pos4 = 3
                                    strUpdate = strUpdate + ` Pos4 = 3 `
                                    break
                                case 5:
                                    Pos5 = 3
                                    strUpdate = strUpdate + ` Pos5 = 3 `
                                    break
                                case 6:
                                    Pos6 = 3
                                    strUpdate = strUpdate + ` Pos6 = 3 `
                                    break
                                case 7:
                                    Pos7 = 3
                                    strUpdate = strUpdate + ` Pos7 = 3 `
                                    break
                                case 8:
                                    Pos8 = 3
                                    strUpdate = strUpdate + ` Pos8 = 3 `
                                    break
                                case 9:
                                    Pos9 = 3
                                    strUpdate = strUpdate + ` Pos9 = 3 `
                                    break
                            }
                            strUpdate = strUpdate + ` WHERE BarcodeID1 = '${_barcode}'`
                            let sqlUpdatePos = await db.query(strUpdate)
                        }
                    }
                }
            }
            lastPos = handleStatePos(Pos1) + handleStatePos(Pos2) + handleStatePos(Pos3) + handleStatePos(Pos4) + handleStatePos(Pos5) + handleStatePos(Pos6) + handleStatePos(Pos7) + handleStatePos(Pos8) + handleStatePos(Pos9)
        } else {
            // First Record Data
            if (parseInt(StationNO) === 1) {
                let insertBarcodeLog = await db.query(`INSERT INTO tblbarcodelog(BarcodeID1) VALUES('${_barcode}')`)
                lastPos = 0
            } else {
                if (ByPassState.length > 0) {
                    let _ByPass_ST1 = 0
                    let _ByPass_ST2 = 0
                    let _ByPass_ST3 = 0
                    let _ByPass_ST4 = 0
                    let _ByPass_ST5 = 0
                    let _ByPass_ST6 = 0
                    let _ByPass_ST7 = 0
                    let _ByPass_ST8 = 0
                    let _ByPass_ST9 = 0
                    let _ByPass_Counter = 0
                    for (var i = 0; i < ByPassState.length; i++) {
                        let _StByPass = parseInt(ByPassState[i].StationNo)
                        if (_StByPass < parseInt(StationNO)) {
                            _ByPass_Counter = _ByPass_Counter + 1
                            switch (_StByPass) {
                                case 1:
                                    _ByPass_ST1 = 3
                                    break
                                case 2:
                                    _ByPass_ST2 = 3
                                    break
                                case 3:
                                    _ByPass_ST3 = 3
                                    break
                                case 4:
                                    _ByPass_ST4 = 3
                                    break
                                case 5:
                                    _ByPass_ST5 = 3
                                    break
                                case 6:
                                    _ByPass_ST6 = 3
                                    break
                                case 7:
                                    _ByPass_ST7 = 3
                                    break
                                case 8:
                                    _ByPass_ST8 = 3
                                    break
                                case 9:
                                    _ByPass_ST9 = 3
                                    break
                            }
                        }
                    }
                    // st# 2
                    // bypass 1 dan 3
                    // 12345 3 0 0 0 0 0 0 0 0  
                    let strQuery = `INSERT INTO tblbarcodelog(BarcodeID1, Pos1, Pos2, Pos3, Pos4, Pos5, Pos6, Pos7, Pos8, Pos9) 
                                                       VALUES('${_barcode}', ${_ByPass_ST1}, ${_ByPass_ST2}, ${_ByPass_ST3}, ${_ByPass_ST1}, ${_ByPass_ST5},
                                                       ${_ByPass_ST6}, ${_ByPass_ST7}, ${_ByPass_ST8}, ${_ByPass_ST9})`
                    let insertBarcodeLog = await db.query(strQuery)
                    lastPos = _ByPass_Counter
                }
            }
        }
    } catch (error) {
        console.log(`Error Query Barcode Position ${error}`)
    }
    return lastPos
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

async function WriteHMIString(_nilai, _address) {
    console.log("String Value:", _nilai)
    console.log('Address:', _address)
    let _reverse_string = ReverseString(_nilai)
    let _arrays = Div2Chr(_nilai)
    let _HMIAddress = parseInt(_address)
    for (var i = 0; i < _arrays.length; i++) {
        let _reverse_string = ReverseString(_arrays[i])
        let _string_to_hex = String2Hex(_reverse_string)
        let _value = parseInt(_string_to_hex, 16)
        console.log(_reverse_string)
        console.log(_value)
        WritePLCData(_HMIAddress, _value)
        _HMIAddress = _HMIAddress + 1
    }
}

async function clearHMIScreen() {
    let _alamatJobName = parseInt(registerAddress.JOB_DESC1)
    let _alamatJobType = parseInt(registerAddress.JOB_ID)
    let _alamatJobQty = parseInt(registerAddress.JOB_QTY)
    let _alamatBarcodeType = parseInt(registerAddress.BARCODE_TYPE)
    for (var i = 0; i < 10; i++) {
        for (var i2 = 0; i2 < 10; i2++) {
            let resetJobName = await WritePLCData((_alamatJobName + i2), 0)
        }
        let resetJobId = await WritePLCData(_alamatJobType, 0)
        let resetJobQty = await WritePLCData(_alamatJobQty, 0)
        let resetBarcodeType = await WritePLCData(_alamatBarcodeType, 0)
        _alamatJobName = _alamatJobName + 10
        _alamatJobType = _alamatJobType + 1
        _alamatJobQty = _alamatJobType + 1
        _alamatBarcodeType = _alamatBarcodeType + 1
    }
}

async function handleBarcodeVerification(barcode) {
    if (onVerificationBarcode === false) {
        onVerificationBarcode = true
        let __continues = ""
        // Verification Barcode Type
        let barcodeType = await handleBarcodeType(barcode)

        let clearScreen = await clearHMIScreen()

        if (barcodeType.length > 0) {
            console.log("barcodeType:", barcodeType[0].description)
            let writeTypeBarcodeHMI = await WriteHMIString(barcodeType[0].description, parseInt(registerAddress.BARCODE_TYPE))
        } else {
            console.log('barcode type not found...!!!!')
            __continues = 'BARCODE_TYPE_NG'
        }

        let barcodePosition

        if (__continues === "") {
            // Verification Barcode Position
            barcodePosition = await handleBarcodePos(barcode)
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
                console.log(`By Pass NG Barcode JOB Order, NG Station# ${barcodeNGPos}`)
                __continues = 'BARCODE_NG_STATION'
            }
        }

        if (__continues === "" && barcodeNGPos === null) {
            if (parseInt(barcodePosition) >= parseInt(StationNO)) {
                console.log(`By Pass JOB Order, Current Station # ${barcodePosition}`)
                __continues = 'BARCODE_BYPASS_STATION'
            } else {
                if (parseInt(barcodePosition) !== (parseInt(StationNO) - 1)) {
                    console.log(`Error Interlock, Current Station# ${StationNO} Last Barcode Station# ${barcodePosition}`)
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

                let _nPos = parseInt(registerAddress.JOB_DESC1)
                let _nPosJobID = parseInt(registerAddress.JOB_ID)
                let _nPosJobQty = parseInt(registerAddress.JOB_QTY)

                for (var i = 0; i < dataJobs.length; i++) {
                    let _tanggal = _isNow.substring(0, 10)
                    let _job_clientip = dataJobs[i].job_clientip
                    let _job_id = dataJobs[i].job_id
                    let _plc_input = dataJobs[i].plc_input
                    let _job_description = dataJobs[i].job_description
                    let _job_qty = dataJobs[i].job_qty
                    const savedata = await db.query(`INSERT INTO tbltransaction_temp(Station_IP, BarcodeID1, TranNo, TranDate, JobId, JobTypeID, JobName, JobQtyProses, StartTime) VALUES('${IpAddress}','${barcode}', '${transactionNumber}', '${_tanggal}', '${_job_id}', '${_plc_input}', '${_job_description}', ${_job_qty},'${_isNow}')`)
                    let tulisHMIJobName = await WriteHMIString(_job_description, _nPos)
                    let tulisJMIJobID = await WritePLCData(_nPosJobID, parseInt(_plc_input))
                    let tulisHMIJobQty = await WritePLCData(_nPosJobQty, parseInt(_job_qty))
                    _nPosJobQty = _nPosJobQty + 1
                    _nPosJobID = _nPosJobID + 1
                    _nPos = _nPos + 10
                }
                console.log('create new data stationpro table')
                let saveStationPro = await db.query(`INSERT INTO tblStationPro(StationIP,StationNo,StationBarcode,StationBarType,StationTranNo,StationDate) VALUES('${IpAddress}',${StationNO},'${barcode}',fnc_bartype(fnc_barparam('${barcode}')),'${transactionNumber}','${_isNow}')`)
                console.log("records:", dataJobs.length)
            } else {
                __continues = 'BARCODE_JOB_NOT_FOUND'
            }
        }
        if (__continues !== "") {
            let _nResult = 0
            switch (__continues) {
                case "BARCODE_NG_STATION":
                    _nResult = errorBarcode.Error_ByPassNGBarcode
                    break
                case "BARCODE_TYPE_NG":
                    _nResult = errorBarcode.Error_TypeEnggineNotFound
                    break
                case "INTERLOCK_ERROR":
                    _nResult = errorBarcode.Error_BarcodeNotSequence
                    break
                case "BARCODE_JOB_NOT_FOUND":
                    _nResult = errorBarcode.Error_TypeEnggineNotFound
                    break
                case "BARCODE_BYPASS_STATION":
                    _nResult = errorBarcode.Error_ByPassBarcode
            }
            let sendBarcodeResult = await WritePLCData(registerAddress.VERIFIKASI_BARCODE, parseInt(_nResult))
        } else {
            let sendBarcodeResult = await WritePLCData(registerAddress.VERIFIKASI_BARCODE, 1)
        }
        onVerificationBarcode = false
        console.log(`Status Process : ${__continues}`)
    }
}

async function handleBarcodeRepair(barcode) {
    if (onVerificationBarcode === false) {
        onVerificationBarcode = true
        let _valueQuery = false
        let barcodeNGData = await handleQueryNGBarcode(barcode)
        if (barcodeNGData.length > 0 && barcodeNGData !== null) {
            _valueQuery = true
            let writeNGTypeBarcode = WriteHMIString((barcodeNGData[0].modeltype), parseInt(registerAddress.BARCODE_TYPE))
            let writeNGPos = WritePLCData(parseInt(barcodeNGData[0].StationNO), parseInt(registerAddress.STATION_NG_POS))
            objD830.nilai = parseInt(barcodeNGData[0].StationNO)
        }
        let writeResult = await WritePLCData(parseInt(registerAddress.VERIFIKASI_BARCODE), (_valueQuery === true ? 1 : parseInt(errorBarcode.Error_BarcodeNGNotFound)))
        onVerificationBarcode = false
    }
}

async function handleQueryNGBarcode(barcode) {
    try {
        let strQuery = `SELECT v.*, fnc_bartype(BarcodeNG) modeltype, s.StationDesc namastation FROM v_tblbarcodeng_pro v, tblstation s WHERE v.StationNo= s.StationNo AND v.BarcodeNG = '${barcode}' AND v.ValidUpdate = 0 LIMIT 0,1 `
        const data = await db.query(sqlQuery, {
            type: QueryTypes.SELECT,
            nest: true
        })
        return data
    } catch (error) {
        console.log(`Error Query NG BarcodeList ${error}`)
        return null
    }
}

async function handleSaveDetailJob(_transactionNo) {
    let _itemQty = objD531.nilai
    let _itemResult = objD541.nilai

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
                let _job_StartTime = mySqlDate(tempdatarecords[i].StartTime)
                // let _job_result = tempdatarecords[i].StatusProcess
                // let _job_qtyActual = tempdatarecords[i].ActualProcess
                let _job_qtyActual = parseInt(_itemQty[i])
                let _job_result = parseInt(_itemResult[i])
                let _qresult = _job_result === 1 ? 'OK' : 'NG'
                const savedata = await db.query(`INSERT INTO tbltransaction(Station_IP, BarcodeID1, TranNo, TranDate, JobId, JobTypeID, JobName, JobQtyProses, StartTime, ActualProcess, StatusProcess, FinishTime)                 
                VALUES('${IpAddress}','${barcode}', '${transactionNumber}', '${_tanggal}', '${_job_id}', '${_plc_input}', '${_job_description}', ${_job_qty},'${_job_StartTime}',${_job_qtyActual},'${_qresult}', '${_isNow}' )`)
            }
            let removetemp = await db.query(`DELETE FROM tbltransaction_temp WHERE TranNo = '${_transactionNo}'`)
        }
    } catch (error) {
        console.log(`error save detail job ${error}`)
    }
}

async function handleSaveFinalData(_transactionNo) {
    let result = objD135.nilai
    // _finalResult = 1 -> OK  2 -> NG
    // Trigger Calling on table tblstationpro (after update)
    let _statusProcess = result === 1 ? 'OK' : 'NG'
    try {
        let strQuery = `UPDATE tblstationpro SET StationResult = '${_statusProcess}' WHERE StationTranNo = '${_transactionNo}'`
        let savedata = await db.query(strQuery)
    } catch (error) {
        console.log(error)
    }
}

async function handleSaveRepair(barcode, gotostation, pos) {
    try {
        let tgl = new Date().toLocaleString("sv-SE", {
            timeZone: "Asia/Jakarta",
            format: "yyyy-MM-dd HH:mm:ss",
        })
        let sqlQuery = `UPDATE tblbarcodeng SET ValidUpdate = 1, LastUpdate = '${tgl}', StationGoTo = ${gotostation} WHERE BarcodeNG = '${barcode}' AND StationNO = ${pos} AND ValidUpdate = 0`
        let savedata = await db.query(strQuery)
    } catch (error) {
        console.log(`Error save data repair ${error}`)
    }
}

const ReadRegisterPLC = async function (_address, _variable, _objectType, _length) {
    let address = parseInt(D0) + parseInt(_address)
    client.readHoldingRegisters(address, _length).then(async function (resp) {
        successCount += 1
        var value = resp.response._body.valuesAsArray;
        if (_variable !== null && _variable !== undefined) {
            if (_objectType === 'integer') {
                eval(_variable).nilai = parseInt(value)
            } else {
                eval(_variable).nilai = value
            }
        }
    },
        function (err) {
            plcStateConnected = false
            console.error(err)
            errorCount += 1
            console.log('Success', successCount, 'Errors', errorCount, 'Reconnect', reconnectCount)
            console.log('Request finished UNsuccessfull.')
        })
}

const WritePLCData = async function (_address, _value, _objectType, _length) {
    console.log("Address:", _address)
    console.log("Value:", _value)
    let address = parseInt(D0) + parseInt(_address)
    client.writeSingleRegister(address, parseInt(_value), 0)
        .then(function (resp) { }).catch(function () {
            console.error(arguments)
        })
}

const InitialPLC = async () => {
    console.log('Setting PLC Paramters')
    // Setting Station Number 
    let SettingPLCStation = await WritePLCData(registerAddress.STATION_NO, parseInt(StationNO), 'INTEGER', 1)
    // Setting Global Timer 
    let SettingGlobalTimer = await WritePLCData(registerAddress.GLOBAL_TIME_SETTING, parseInt(registerAddress.TimerProcess), 'INTEGER', 1)
    console.log('Setting PLC Paramters Completed')
}

const shutdown = function () {
    plcStateConnected = false
    closedOnPurpose = true
    socket.end()
    process.exit(1)

}

socket.on("connect", function () {
    if (__ByPass === false) {
        console.log(`Client connected into PLC Station# ${StationNO} IP#: ${IpAddress}.`)
        plcStateConnected = true
        if (firstTime) {
            firstTime = false
            InitialPLC()
        }
        let TimerHeartBit =
            setInterval(function () {
                let _isNow = new Date().toLocaleString("sv-SE", {
                    timeZone: "Asia/Jakarta",
                    format: "yyyy-MM-dd HH:mm:ss",
                })
                // var delta = Date.now() - sekarang // milliseconds elapsed since start
                console.log(_isNow);
                console.log(`Heartbit Value ${counterHeartBit} times in 3 seconds`)
                if (counterHeartBit < 3) {
                    console.log("--------------------koneksi terputus-----------------------")
                }

                if (plcStateConnected) {
                    counterHeartBit = 0
                    ReadRegisterPLC(560, 'objD560', 'integer', 1) // HeartBit data
                } else {
                    clearInterval(TimerHeartBit)

                }
            }, 3000) // update about every seco

        var sekarang = Date.now()

        let TimerRegister =
            setInterval(function () {
                if (plcStateConnected) {
                    ReadRegisterPLC(parseInt(registerAddress.BARCODE_CHECK), 'objD140', 'integer', 1) // Barcode Data From PLC
                    ReadRegisterPLC(100, 'objD100', 'string', 10) // Barcode Data From PLC
                    ReadRegisterPLC(600, 'objD600', 'integer', 1) // HeartBit data
                    if (parseInt(StationNO) === 10) {
                        ReadRegisterPLC(parseInt(registerAddress.STATION_NG_INPUT), 'objD810', 'integer', 1) // Set input station goto - repair station 
                        ReadRegisterPLC(parseInt(registerAddress.STATION_NG_CONFIRM), 'objD812', 'integer', 1) // Trigger Save Confirm From Repair Station         
                    } else {
                        ReadRegisterPLC(parseInt(registerAddress.ACTUAL), 'objD531', 'string', 10) // Actual QTY Job Item 
                        ReadRegisterPLC(parseInt(registerAddress.RESULT), 'objD541', 'string', 10) // Result QTY Job Item 
                        ReadRegisterPLC(parseInt(registerAddress.FINAL_RESULT), 'objD135', 'integer', 1) // Result QTY Job Item 
                        ReadRegisterPLC(parseInt(registerAddress.TRIGGER_SAVE), 'objD137', 'integer', 1) // Trigger Save From PLC         
                    }
                } else {
                    clearInterval(TimerRegister)
                }
                // ReadRegisterPLC(parseInt(registerAddress.JOB_DESC1), 'objD431', 'string', 10)
                // ReadRegisterPLC(parseInt(registerAddress.JOB_DESC2), 'objD441', 'string', 10)
            }, 100) // miliseconds
    }
})

socket.on("error", function (err) {
    console.log("------------------------------- Client Error", err)
    counterHeartBit = 0
    plcStateConnected = false
})

socket.on('close', function () {
    if (__ByPass === false) {
        console.log('Client closed, stopping interval.')
        plcStateConnected = false
        if (!closedOnPurpose) {
            try {
                console.log(`Reconnecting into Station #${StationNO} - PLC Address ${IpAddress}`)
                firstTime = false
                socket.connect(options)
                plcStateConnected = true
            } catch (err) {
                counterHeartBit = 0
                console.log(err);
            }
        }
    }
})

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

socket.connect(options)