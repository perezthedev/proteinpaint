// Syntax: cd .. && cargo build --release && echo CTCCCAGTGGCTCCCCAGAGGGGCCAAGCTGAAGTTCGGGCTAAGGCCGGGCAGGCTCGAGTGAAACAGTGTGGCAGCCAGATGATGTGACGGAATCTCT:TTCAATTTAGCCACCTGCTTCCGGGCTGATGGCCTCCCAGTGGCTCCCCAGAGGGGCCAAGCTGAAGTTCGGGCTAAGGCCGGGCAGGCTCGAGTGAAACAGGAAAGCGTAGGGGTCTTTGCTTGCAAGAACAAGTGGCAGCCAGATGATGTGACGGAATCTCTGCCGCCCAAGAAGATGAAGTGCGGCAAAGAGAAGGACAGTGAAGAGCAGCAGCTCCAGCCACAAGCCAAGG:TTCAATTTAGCCACCTGCTTCCGGGCTGATGGCCTCCCAGTGGCTCCCCAGAGGGGCCAAGCTGAAGTTCGGGCTAAGGCCGGGCAGGCTCGAGTGAAACAGTGTGGCAGCCAGATGATGTGACGGAATCTCTGCCGCCCAAGAAGATGAAGTGCGGCAAAGAGAAGGACAGTGAAGAGCAGCAGCTCCAGCCACAAGCCAAGG | target/release/read_alignment
use bio::alignment::pairwise::*;
use bio::alignment::AlignmentOperation;
//use bio::scores::blosum62;
use std::io;

fn main() {
    let mut input = String::new();
    match io::stdin().read_line(&mut input) {
        // Accepting the piped input from nodejs (or command line from testing)
        #[allow(unused_variables)]
        Ok(n) => {
            //println!("{} bytes read", n);
            //println!("{}", input);
        }
        Err(error) => println!("Piping error: {}", error),
    }
    let args: Vec<&str> = input.split(":").collect(); // Various input from nodejs is separated by ":" characater
    let query_seq: String = args[0].parse::<String>().unwrap(); // Query sequence
    let ref_seq: String = args[1].parse::<String>().unwrap().replace("\n", ""); // Reference sequence. Removing "\n" from the end of string
    let alt_seq: String = args[2].parse::<String>().unwrap().replace("\n", ""); // Alternate sequence. Removing "\n" from the end of string
    let (q_seq_ref, align_ref, r_seq_ref) = align_reads(&query_seq, ref_seq); // Aligning against reference
    let (q_seq_alt, align_alt, r_seq_alt) = align_reads(&query_seq, alt_seq); // Aligning against alternate
    println!("q_seq_ref:{}", q_seq_ref);
    println!("align_ref:{}", align_ref);
    println!("r_seq_ref:{}", r_seq_ref);
    println!("q_seq_alt:{}", q_seq_alt);
    println!("align_alt:{}", align_alt);
    println!("r_seq_alt:{}", r_seq_alt);
}

fn align_reads(query_seq: &String, ref_seq: String) -> (String, String, String) {
    let query_vector: Vec<_> = query_seq.chars().collect();
    let ref_vector: Vec<_> = ref_seq.chars().collect();

    let score = |a: u8, b: u8| if a == b { 1i32 } else { -1i32 };
    // gap open score: -5, gap extension score: -1

    let mut aligner = Aligner::with_capacity(
        query_seq.as_bytes().len(),
        ref_seq.as_bytes().len(),
        -5, // gap open penalty
        -1, // gap extension penalty
        &score,
    );

    let alignment = aligner.global(query_seq.as_bytes(), ref_seq.as_bytes());
    //let alignment = aligner.semiglobal(query_seq.as_bytes(), ref_seq.as_bytes());
    //let alignment = aligner.local(query_seq.as_bytes(), ref_seq.as_bytes());

    //let scoring = Scoring::from_scores(-5, -1, 1, -1) // Gap open, extend, match, mismatch score
    //    .xclip(MIN_SCORE) // Clipping penalty for x set to 'negative infinity', hence global in x
    //    .yclip(MIN_SCORE); // Clipping penalty for y set to 'negative infinity', hence global in y
    //
    //let mut aligner = Aligner::with_scoring(scoring);
    //let alignment = aligner.custom(query_seq.as_bytes(), ref_seq.as_bytes());

    let alignment_seq = alignment.operations;
    let mut q_seq: String = String::new();
    let mut align: String = String::new();
    let mut r_seq: String = String::new();
    let mut j: usize = 0;
    let mut k: usize = 0;
    for i in 0..alignment_seq.len() {
        if AlignmentOperation::Match == alignment_seq[i] {
            if j < query_vector.len() {
                q_seq += &query_vector[j].to_string();
                j += 1;
            }
            if k < ref_vector.len() {
                r_seq += &ref_vector[k].to_string();
                k += 1;
            }
            align += &"|".to_string(); // Add "|" when there is a match
        } else if AlignmentOperation::Subst == alignment_seq[i] {
            if j < query_vector.len() {
                q_seq += &query_vector[j].to_string();
                j += 1;
            }
            if k < ref_vector.len() {
                r_seq += &ref_vector[k].to_string();
                k += 1;
            }
            align += &"*".to_string(); // Add "*" when there is a substitution
        } else if AlignmentOperation::Del == alignment_seq[i] {
            if j > 0 && j < query_vector.len() {
                // This condition is added so as to suppress part of the reference sequence that do not lie within the read region
                q_seq += &"-".to_string();
            }
            if k < ref_vector.len() {
                if j > 0 && j < query_vector.len() {
                    // This condition is added so as to suppress part of the reference sequence that do not lie within the read region
                    r_seq += &ref_vector[k].to_string();
                }
                k += 1;
            }
            if j > 0 && j < query_vector.len() {
                // This condition is added so as to suppress part of the reference sequence that do not lie within the read region
                align += &"x".to_string(); // Add "x" when there is a deletion
            }
        } else if AlignmentOperation::Ins == alignment_seq[i] {
            if j < query_vector.len() {
                q_seq += &query_vector[j].to_string();
                j += 1;
            }
            r_seq += &"-".to_string();
            align += &"x".to_string(); // Add "x" when there is a insertion
        } else {
            println!("Alignment operation not found:{}{:?}", i, alignment_seq[i]);
        }
    }
    (q_seq, align, r_seq)
}
