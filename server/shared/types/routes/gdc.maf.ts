// an object representing gdc maf file, to be shown on client table

export type File = {
	/** A string representing the file's UUID (Universally Unique Identifier) , can be accessed via https://api.gdc.cancer.gov/data/<uuid>*/
	id: string
	/** A string representing a submitter ID for the case associated with this file */
	case_submitter_id: string
	/** A string representing the experimental strategy (scientific method) used for generating this file */
	experimental_strategy: string
	/** A string representing the file size */
	file_size: string // todo
	/** Array of strings, each is a sample type, for all samples involved in generating the maf file */
	sample_types: string[]
	/** A string representing the type of workflow used to generate or process this file */
	workflow_type: string
	/** A string as the project id of the case */
	project_id: string
}

export type GdcMafResponse = {
	files: File[]
}
