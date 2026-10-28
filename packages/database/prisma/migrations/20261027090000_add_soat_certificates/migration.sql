CREATE TABLE "SoatCertificate" (
  "id" TEXT NOT NULL,
  "Placa" TEXT NOT NULL,
  "NombreCompania" TEXT NOT NULL,
  "NumeroPoliza" TEXT NOT NULL,
  "FechaInicio" TEXT NOT NULL,
  "FechaFin" TEXT NOT NULL,
  "Estado" TEXT NOT NULL,
  "NombreUsoVehiculo" TEXT NOT NULL,
  "NombreClaseVehiculo" TEXT NOT NULL,
  "TipoCertificado" TEXT NOT NULL,
  "CodigoUnicoPoliza" TEXT,
  "CodigoSBSAseguradora" TEXT,
  "FechaControlPolicial" TEXT,
  "NombreContratante" TEXT,
  "NombreUbigeo" TEXT,
  "NumeroSerieMotor" TEXT,
  "NumeroSerieChasis" TEXT,
  "NumeroAseguradora" TEXT,
  "FechaCreacion" TEXT,
  "FechaAnulacion" TEXT,
  "NumeroAsientos" INTEGER,
  "ModeloVehiculo" TEXT,
  "Marca" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SoatCertificate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SoatCertificate_Placa_NombreCompania_NumeroPoliza_key"
ON "SoatCertificate"("Placa", "NombreCompania", "NumeroPoliza");
CREATE INDEX "SoatCertificate_Placa_FechaInicio_idx" ON "SoatCertificate"("Placa", "FechaInicio");
