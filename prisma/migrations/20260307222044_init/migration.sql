-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'ASSISTANT',
    "permissions" TEXT NOT NULL DEFAULT '[]',
    "pageSize" INTEGER NOT NULL DEFAULT 10,
    "preferredLocale" TEXT NOT NULL DEFAULT 'bg',
    "darkMode" BOOLEAN NOT NULL DEFAULT true,
    "recoveryCode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "companyName" TEXT NOT NULL DEFAULT '',
    "companyAddress" TEXT NOT NULL DEFAULT '',
    "logoPath" TEXT,
    "frotcomUsername" TEXT NOT NULL DEFAULT 'B5jX21vu0w3SV6S',
    "frotcomPassword" TEXT NOT NULL DEFAULT '0NnHoC6cF119xPSJLnbNcTBgSXq2',
    "frotcomToken" TEXT
);

-- CreateTable
CREATE TABLE "Bay" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "Truck" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "plateNumber" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER,
    "frotcomVehicleId" TEXT,
    "currentMileage" REAL,
    "useCanbusMileage" BOOLEAN NOT NULL DEFAULT true,
    "mileageTriggerKm" REAL NOT NULL DEFAULT 30000,
    "isAdr" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Mechanic" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "Driver" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "frotcomDriverId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "ServiceOrder" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "truckId" INTEGER NOT NULL,
    "truckPlateSnapshot" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "bayId" INTEGER,
    "bayNameSnapshot" TEXT,
    "scheduledDate" DATETIME NOT NULL,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "mileageAtService" REAL,
    "driverId" INTEGER,
    "driverNameSnapshot" TEXT,
    "driverFeedbackNotes" TEXT,
    "cancellationReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ServiceOrder_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "Truck" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ServiceOrder_bayId_fkey" FOREIGN KEY ("bayId") REFERENCES "Bay" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ServiceOrder_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ServiceSection" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "serviceOrderId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "intakeSkippedAt" DATETIME,
    "intakeSkipNote" TEXT,
    "exitSkippedAt" DATETIME,
    "exitSkipNote" TEXT,
    CONSTRAINT "ServiceSection_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ServiceChecklistItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "serviceSectionId" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" DATETIME,
    "completedByName" TEXT,
    CONSTRAINT "ServiceChecklistItem_serviceSectionId_fkey" FOREIGN KEY ("serviceSectionId") REFERENCES "ServiceSection" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkCard" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "serviceSectionId" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "mechanicId" INTEGER,
    "mechanicName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "specialInstructions" TEXT,
    "cancelledAt" DATETIME,
    "reopenedAt" DATETIME,
    CONSTRAINT "WorkCard_serviceSectionId_fkey" FOREIGN KEY ("serviceSectionId") REFERENCES "ServiceSection" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorkCard_mechanicId_fkey" FOREIGN KEY ("mechanicId") REFERENCES "Mechanic" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkCardNote" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "workCardId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "userNameSnapshot" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkCardNote_workCardId_fkey" FOREIGN KEY ("workCardId") REFERENCES "WorkCard" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorkCardNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChecklistTemplate" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "description" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "EquipmentItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "AdrEquipmentItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "EquipmentCheckItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "serviceOrderId" INTEGER NOT NULL,
    "itemName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PRESENT',
    "explanation" TEXT,
    "checkType" TEXT NOT NULL,
    CONSTRAINT "EquipmentCheckItem_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TruckEquipmentSnapshot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "truckId" INTEGER NOT NULL,
    "serviceOrderId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TruckEquipmentSnapshot_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "Truck" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TruckEquipmentSnapshot_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TruckEquipmentSnapshotItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "snapshotId" INTEGER NOT NULL,
    "itemName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    CONSTRAINT "TruckEquipmentSnapshotItem_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "TruckEquipmentSnapshot" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DriverFeedbackItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "serviceOrderId" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    CONSTRAINT "DriverFeedbackItem_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Part" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "workCardId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "partNumber" TEXT,
    "quantity" REAL NOT NULL,
    "unitCost" REAL,
    CONSTRAINT "Part_workCardId_fkey" FOREIGN KEY ("workCardId") REFERENCES "WorkCard" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Photo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "serviceOrderId" INTEGER,
    "workCardId" INTEGER,
    "caption" TEXT,
    "filePath" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Photo_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Photo_workCardId_fkey" FOREIGN KEY ("workCardId") REFERENCES "WorkCard" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Note" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "serviceOrderId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "userNameSnapshot" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Note_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Note_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER,
    "userNameSnapshot" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Truck_plateNumber_key" ON "Truck"("plateNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Truck_frotcomVehicleId_key" ON "Truck"("frotcomVehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_frotcomDriverId_key" ON "Driver"("frotcomDriverId");
